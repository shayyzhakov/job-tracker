import type {
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationListQuery,
  ApplicationStatus,
  ApplicationUpdate,
  ContactInput,
} from '@job-tracker/shared';
import { CLOSED_STATUSES } from '@job-tracker/shared';
import { and, asc, desc, eq, ilike, inArray, notInArray, or, type SQL, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { toApplicationDto, toContactDto, toHistoryDto, toInterviewDto } from '../../db/mappers.js';
import { applications, companies, contacts, interviews, statusHistory } from '../../db/schema.js';

export interface NewApplication {
  companyId: string;
  roleName: string;
  isManagement: boolean;
  status: ApplicationStatus;
  listingUrl?: string;
  expectedSalaryIls?: number;
  source?: string;
  notes?: string;
  appliedAt: Date | null;
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
  delete(id: string): Promise<boolean>;
}

const nextInterviewAt = sql<Date | null>`(
  select min(${interviews.scheduledAt}) from ${interviews}
  where ${interviews.applicationId} = ${applications.id} and ${interviews.scheduledAt} > now()
)`.mapWith((v: string | Date | null) => (v ? new Date(v) : null));

export class DrizzleApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly db: Db) {}

  async insert(app: NewApplication, contactInputs: ContactInput[], at: Date) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(applications)
        .values({ ...app, createdAt: at, updatedAt: at })
        .returning({ id: applications.id });
      if (!row) throw new Error('Failed to insert application');
      if (contactInputs.length > 0) {
        await tx.insert(contacts).values(
          contactInputs.map((c, i) => ({
            ...c,
            applicationId: row.id,
            // Same-statement rows share now(); offset by 1ms to keep input order stable.
            createdAt: new Date(at.getTime() + i),
          })),
        );
      }
      await tx
        .insert(statusHistory)
        .values({ applicationId: row.id, fromStatus: null, toStatus: app.status, changedAt: at });
      return row.id;
    });
  }

  private baseQuery(where?: SQL) {
    return this.db
      .select({ application: applications, company: companies, nextInterviewAt })
      .from(applications)
      .innerJoin(companies, eq(applications.companyId, companies.id))
      .where(where);
  }

  async findById(id: string): Promise<ApplicationDetailDto | null> {
    const [row] = await this.baseQuery(eq(applications.id, id));
    if (!row) return null;
    const [contactRows, interviewRows, historyRows] = await Promise.all([
      this.db
        .select()
        .from(contacts)
        .where(eq(contacts.applicationId, id))
        .orderBy(asc(contacts.createdAt), asc(contacts.id)),
      this.db
        .select()
        .from(interviews)
        .where(eq(interviews.applicationId, id))
        .orderBy(asc(interviews.scheduledAt)),
      this.db
        .select()
        .from(statusHistory)
        .where(eq(statusHistory.applicationId, id))
        .orderBy(asc(statusHistory.changedAt), asc(statusHistory.id)),
    ]);
    return {
      ...toApplicationDto(row.application, row.company, row.nextInterviewAt),
      contacts: contactRows.map(toContactDto),
      interviews: interviewRows.map(toInterviewDto),
      history: historyRows.map(toHistoryDto),
    };
  }

  async list(query: ApplicationListQuery) {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(applications.status, query.status));
    if (query.active === true)
      conditions.push(notInArray(applications.status, [...CLOSED_STATUSES]));
    if (query.active === false) conditions.push(inArray(applications.status, [...CLOSED_STATUSES]));
    if (query.q) {
      const pattern = `%${query.q}%`;
      const match = or(ilike(companies.name, pattern), ilike(applications.roleName, pattern));
      if (match) conditions.push(match);
    }
    const rows = await this.baseQuery(and(...conditions)).orderBy(desc(applications.updatedAt));
    return rows.map((r) => toApplicationDto(r.application, r.company, r.nextInterviewAt));
  }

  async getState(id: string) {
    const [row] = await this.db
      .select({
        companyId: applications.companyId,
        status: applications.status,
        appliedAt: applications.appliedAt,
      })
      .from(applications)
      .where(eq(applications.id, id));
    return row ?? null;
  }

  async update(id: string, patch: ApplicationFieldsPatch) {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(applications).set(patch).where(eq(applications.id, id));
  }

  async changeStatus(id: string, { from, to, appliedAt, at }: StatusTransition) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(applications)
        .set({ status: to, appliedAt, updatedAt: at })
        .where(eq(applications.id, id));
      await tx
        .insert(statusHistory)
        .values({ applicationId: id, fromStatus: from, toStatus: to, changedAt: at });
    });
  }

  async delete(id: string) {
    const deleted = await this.db
      .delete(applications)
      .where(eq(applications.id, id))
      .returning({ id: applications.id });
    return deleted.length > 0;
  }
}
