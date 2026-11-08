import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationListQuery,
  ApplicationMethod,
  ApplicationStatus,
  ApplicationUpdate,
  ContactInput,
  HandOverReason,
  ReferralChannel,
} from '@job-tracker/shared';
import { statusGroup } from '@job-tracker/shared';
import {
  batchDelete,
  buildUpdate,
  type Db,
  dateOrNull,
  GSI2,
  isConditionFailed,
  iso,
  isoOrNull,
  key,
  queryAll,
  queryGsi1,
  queryPartition,
} from '../../db/dynamo.js';
import {
  type ApplicationItem,
  type CompanyItem,
  type ContactItem,
  type HistoryItem,
  type InterviewItem,
  type NoteItem,
  nul,
  toApplicationDto,
  toContactDto,
  toHistoryDto,
  toInterviewDto,
  toNoteDto,
} from '../../db/mappers.js';

export interface NewApplication {
  companyId: string;
  roleName: string;
  isManagement: boolean;
  status: ApplicationStatus;
  listingUrl?: string;
  expectedSalaryIls?: number;
  source?: string;
  applicationMethod?: ApplicationMethod;
  referrerName?: string;
  referrerChannel?: ReferralChannel;
  methodDetails?: string;
  notes?: string;
  appliedAt: Date | null;
  replyBy?: Date;
  dueAt?: Date;
  nextStep?: string;
}

export type ApplicationFieldsPatch = Omit<ApplicationUpdate, 'company'>;

export interface ApplicationState {
  companyId: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
}

export interface StatusTransition {
  from: ApplicationStatus;
  to: ApplicationStatus;
  appliedAt: Date | null;
  at: Date;
  /** Interview created for (or behind) this step, if it is an interview round. */
  interviewId?: string | null;
  /** Timeline the employer gave for the new stage; replaces whatever the previous stage had. */
  replyBy?: Date | null;
  dueAt?: Date | null;
}

export interface ApplicationsRepository {
  /** Inserts the application, its contacts and the initial history entry atomically. */
  insert(app: NewApplication, contacts: ContactInput[], at: Date): Promise<string>;
  findById(id: string): Promise<ApplicationDetailDto | null>;
  list(query: ApplicationListQuery): Promise<ApplicationDto[]>;
  getState(id: string): Promise<ApplicationState | null>;
  update(id: string, patch: ApplicationFieldsPatch): Promise<void>;
  /** Updates status (and appliedAt) and appends a history entry atomically. */
  changeStatus(id: string, transition: StatusTransition): Promise<void>;
  /** Hides the application's action card until `until`. False when the application doesn't exist. */
  snooze(id: string, until: Date): Promise<boolean>;
  /** Hands the ball to the employer at `at`; a follow-up also counts toward the ghosted prompt. */
  handOver(id: string, reason: HandOverReason, at: Date): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

/** Applications are listed newest-updated first through GSI1. */
export const appIndexKeys = (id: string, updatedAt: string) => ({
  GSI1PK: 'APPS',
  GSI1SK: `${updatedAt}#${id}`,
});

/** Interviews are indexed by time through GSI1 (upcoming interviews, next interview per application). */
export const interviewIndexKeys = (id: string, scheduledAt: string) => ({
  GSI1PK: 'INTERVIEWS',
  GSI1SK: `${scheduledAt}#${id}`,
});

/** Sort-key bound strictly after `at`: '~' sorts after the '#' that separates the id. */
export const afterTime = (at: Date) => `${iso(at)}~`;

const historyItem = (
  applicationId: string,
  fromStatus: ApplicationStatus | null,
  toStatus: ApplicationStatus,
  changedAt: string,
  interviewId: string | null = null,
): HistoryItem => ({
  id: randomUUID(),
  applicationId,
  fromStatus,
  toStatus,
  changedAt,
  interviewId,
});

const byCreated = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export class DynamoApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly db: Db) {}

  async insert(app: NewApplication, contactInputs: ContactInput[], at: Date) {
    const id = randomUUID();
    const now = iso(at);
    const item: ApplicationItem = {
      id,
      companyId: app.companyId,
      roleName: app.roleName,
      isManagement: app.isManagement,
      status: app.status,
      listingUrl: nul(app.listingUrl),
      expectedSalaryIls: nul(app.expectedSalaryIls),
      source: nul(app.source),
      applicationMethod: nul(app.applicationMethod),
      referrerName: nul(app.referrerName),
      referrerChannel: nul(app.referrerChannel),
      methodDetails: nul(app.methodDetails),
      notes: nul(app.notes),
      appliedAt: isoOrNull(app.appliedAt),
      reachedStatuses: [app.status],
      replyBy: isoOrNull(app.replyBy ?? null),
      dueAt: isoOrNull(app.dueAt ?? null),
      nextStep: nul(app.nextStep),
      snoozedUntil: null,
      // An application added as already applied (appliedAt may be in the past) has been waiting since then.
      statusChangedAt: app.status === 'applied' && app.appliedAt ? iso(app.appliedAt) : now,
      waitingOnThemAt: null,
      followUps: 0,
      createdAt: now,
      updatedAt: now,
    };
    const history = historyItem(id, null, app.status, now);
    const contactItems = contactInputs.map((c, i): ContactItem => {
      // Offset by 1ms per contact to keep input order stable.
      const createdAt = iso(new Date(at.getTime() + i));
      return {
        id: randomUUID(),
        applicationId: id,
        name: c.name,
        role: nul(c.role),
        email: nul(c.email),
        phone: nul(c.phone),
        linkedinUrl: nul(c.linkedinUrl),
        notes: nul(c.notes),
        createdAt,
        updatedAt: createdAt,
      };
    });
    const put = (Item: Record<string, unknown>) => ({
      Put: { TableName: this.db.table, Item },
    });
    await this.db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          put({ ...key.app(id), ...appIndexKeys(id, now), ...item }),
          ...contactItems.map((c) => put({ ...key.contact(id, c.id), ...c })),
          put({ ...key.history(id, now, history.id), ...history }),
        ],
      }),
    );
    return id;
  }

  /** Earliest interview strictly after `now` per application id. */
  private async interviewTimes(now: Date) {
    const all = await queryGsi1<InterviewItem>(this.db, 'INTERVIEWS');
    const after = afterTime(now);
    const times = new Map<string, { next: string | null; hasPast: boolean }>();
    for (const i of all) {
      const t = times.get(i.applicationId) ?? { next: null, hasPast: false };
      if (`${i.scheduledAt}` > after) t.next ??= i.scheduledAt;
      else t.hasPast = true;
      times.set(i.applicationId, t);
    }
    return times;
  }

  async findById(id: string): Promise<ApplicationDetailDto | null> {
    const items = await queryPartition(this.db, key.app(id).PK);
    const app = items.find((i) => i.SK === 'META') as ApplicationItem | undefined;
    if (!app) return null;
    const company = (
      await this.db.doc.send(
        new GetCommand({
          TableName: this.db.table,
          Key: key.company(app.companyId),
        }),
      )
    ).Item as CompanyItem;
    const ofKind = <T>(prefix: string) =>
      items.filter((i) => (i.SK as string).startsWith(prefix)) as unknown as T[];
    const contacts = ofKind<ContactItem>('CONTACT#').sort(byCreated);
    const interviews = ofKind<InterviewItem>('INTERVIEW#').sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt),
    );
    const interviewIds = new Set(interviews.map((i) => i.id));
    // Newest first; notes of an interview that no longer exists (failed cascade) are dropped.
    const notes = ofKind<NoteItem>('NOTE#')
      .filter((n) => interviewIds.has(n.interviewId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const history = ofKind<HistoryItem>('HISTORY#'); // sort key already orders by time then id
    const nowIso = iso(new Date());
    const next = interviews.find((i) => i.scheduledAt > nowIso)?.scheduledAt ?? null;
    const hasPast = interviews.some((i) => i.scheduledAt <= nowIso);
    return {
      ...toApplicationDto(app, company, next, hasPast),
      contacts: contacts.map(toContactDto),
      interviews: interviews.map(toInterviewDto),
      interviewNotes: notes.map(toNoteDto),
      history: history.map(toHistoryDto),
    };
  }

  async list(query: ApplicationListQuery) {
    const [apps, companies, times] = await Promise.all([
      queryGsi1<ApplicationItem>(this.db, 'APPS', { desc: true }),
      queryGsi1<CompanyItem>(this.db, 'COMPANIES'),
      this.interviewTimes(new Date()),
    ]);
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const needle = query.q?.toLowerCase();
    return apps
      .filter((a) => {
        if (query.status && a.status !== query.status) return false;
        if (query.groups && !query.groups.includes(statusGroup(a.status))) return false;
        if (needle) {
          const company = companyById.get(a.companyId);
          const hit =
            a.roleName.toLowerCase().includes(needle) ||
            company?.name.toLowerCase().includes(needle);
          if (!hit) return false;
        }
        return true;
      })
      .flatMap((a): ApplicationDto[] => {
        const company = companyById.get(a.companyId);
        const t = times.get(a.id);
        return company ? [toApplicationDto(a, company, t?.next ?? null, t?.hasPast ?? false)] : [];
      });
  }

  async getState(id: string) {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.app(id) }),
    );
    const a = res.Item as ApplicationItem | undefined;
    return a
      ? {
          companyId: a.companyId,
          status: a.status,
          appliedAt: dateOrNull(a.appliedAt),
        }
      : null;
  }

  async update(id: string, patch: ApplicationFieldsPatch) {
    if (Object.keys(patch).length === 0) return;
    const { appliedAt, replyBy, dueAt, ...rest } = patch;
    const updatedAt = iso(new Date());
    try {
      await this.db.doc.send(
        new UpdateCommand({
          TableName: this.db.table,
          Key: key.app(id),
          ConditionExpression: 'attribute_exists(PK)',
          ...buildUpdate({
            ...rest,
            ...(appliedAt !== undefined && { appliedAt: isoOrNull(appliedAt) }),
            ...(replyBy !== undefined && { replyBy: isoOrNull(replyBy) }),
            ...(dueAt !== undefined && { dueAt: isoOrNull(dueAt) }),
            updatedAt,
            GSI1SK: appIndexKeys(id, updatedAt).GSI1SK,
          }),
        }),
      );
    } catch (err) {
      if (!isConditionFailed(err)) throw err;
    }
  }

  async changeStatus(
    id: string,
    { from, to, appliedAt, at, interviewId, replyBy, dueAt }: StatusTransition,
  ) {
    const current = (
      await this.db.doc.send(new GetCommand({ TableName: this.db.table, Key: key.app(id) }))
    ).Item as ApplicationItem | undefined;
    if (!current) return;
    const changedAt = iso(at);
    const history = historyItem(id, from, to, changedAt, interviewId ?? null);
    const reached = [...new Set([...current.reachedStatuses, to])];
    await this.db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.db.table,
              Key: key.app(id),
              ConditionExpression: 'attribute_exists(PK)',
              ...buildUpdate({
                status: to,
                appliedAt: isoOrNull(appliedAt),
                reachedStatuses: reached,
                // A new stage starts a new wait: the old hand-over, snooze and timeline no longer apply.
                statusChangedAt: changedAt,
                waitingOnThemAt: null,
                followUps: 0,
                snoozedUntil: null,
                replyBy: isoOrNull(replyBy ?? null),
                dueAt: isoOrNull(dueAt ?? null),
                updatedAt: changedAt,
                GSI1SK: appIndexKeys(id, changedAt).GSI1SK,
              }),
            },
          },
          {
            Put: {
              TableName: this.db.table,
              Item: { ...key.history(id, changedAt, history.id), ...history },
            },
          },
        ],
      }),
    );
  }

  async snooze(id: string, until: Date) {
    return this.touch(id, { snoozedUntil: iso(until) });
  }

  async handOver(id: string, reason: HandOverReason, at: Date) {
    return this.touch(id, { waitingOnThemAt: iso(at) }, reason === 'followed_up');
  }

  /** Sets attributes without bumping updatedAt, so list ordering isn't disturbed. */
  private async touch(id: string, set: Record<string, unknown>, countFollowUp = false) {
    const update = buildUpdate(set);
    try {
      await this.db.doc.send(
        new UpdateCommand({
          TableName: this.db.table,
          Key: key.app(id),
          ConditionExpression: 'attribute_exists(PK)',
          ...update,
          UpdateExpression: `${update.UpdateExpression}${countFollowUp ? ' ADD followUps :one' : ''}`,
          ExpressionAttributeValues: {
            ...update.ExpressionAttributeValues,
            ...(countFollowUp && { ':one': 1 }),
          },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailed(err)) return false;
      throw err;
    }
  }

  async delete(id: string) {
    const items = await queryPartition(this.db, key.app(id).PK);
    if (!items.some((i) => i.SK === 'META')) return false;
    await batchDelete(
      this.db,
      items.map((i) => ({ PK: i.PK as string, SK: i.SK as string })),
    );
    // Suggestions promoted into this application keep existing but lose the link.
    const linked = await queryAll<{ id: string }>(this.db, {
      IndexName: GSI2,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `APPOPP#${id}` },
    });
    await Promise.all(
      linked.map((o) =>
        this.db.doc.send(
          new UpdateCommand({
            TableName: this.db.table,
            Key: key.opportunity(o.id),
            ...buildUpdate({ applicationId: null, updatedAt: iso(new Date()) }, [
              'GSI2PK',
              'GSI2SK',
            ]),
          }),
        ),
      ),
    );
    return true;
  }
}
