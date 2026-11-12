// In-memory repositories for fast service unit tests (no DB).
import { randomUUID } from 'node:crypto';
import type {
  ApplicationDetailDto,
  ApplicationListQuery,
  CompanyApplicationDto,
  CompanyDto,
  CompanyInput,
  ContactAttach,
  ContactInput,
  HandOverReason,
  InterviewDto,
  InterviewInput,
  OpportunityDto,
  OpportunityListQuery,
  ScoutCriteria,
  ScoutCriteriaDto,
} from '@job-tracker/shared';
import { DEFAULT_COMPANY_PRIORITY, DEFAULT_SCOUT_CRITERIA, statusGroup } from '@job-tracker/shared';
import type {
  ApplicationFieldsPatch,
  ApplicationsRepository,
  NewApplication,
  StatusTransition,
} from '../src/modules/applications/applications.repository.js';
import type {
  CompaniesRepository,
  CompanyPatch,
} from '../src/modules/companies/companies.repository.js';
import type {
  NewOpportunity,
  OpportunitiesRepository,
  StatusChange,
} from '../src/modules/opportunities/opportunities.repository.js';
import type { ScoutCriteriaRepository } from '../src/modules/scout-criteria/scout-criteria.repository.js';

export class FakeCompaniesRepository implements CompaniesRepository {
  rows: CompanyDto[] = [];

  async findById(id: string) {
    return this.rows.find((c) => c.id === id) ?? null;
  }
  async findByName(name: string) {
    return this.rows.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
  }
  async create(input: CompanyInput) {
    const row: CompanyDto = {
      id: randomUUID(),
      name: input.name,
      size: input.size ?? null,
      priority: input.priority ?? DEFAULT_COMPANY_PRIORITY,
      isPublic: input.isPublic,
      website: input.website ?? null,
      location: input.location ?? null,
    };
    this.rows.push(row);
    return row;
  }
  async update(id: string, patch: CompanyPatch) {
    const row = this.rows.find((c) => c.id === id);
    if (row) Object.assign(row, patch);
  }
  async search(q?: string) {
    return this.list(q);
  }
  async list(q?: string) {
    return this.rows.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  }
  async applicationsByCompany() {
    return new Map<string, CompanyApplicationDto[]>();
  }
  async delete(id: string) {
    this.rows = this.rows.filter((c) => c.id !== id);
  }
}

const isContactInput = (c: ContactAttach): c is ContactInput => !('contactId' in c);

type StoredApp = Omit<ApplicationDetailDto, 'company'> & { companyId: string };

export class FakeApplicationsRepository implements ApplicationsRepository {
  rows: StoredApp[] = [];
  constructor(private readonly companies: FakeCompaniesRepository) {}

  async insert(app: NewApplication, contacts: ContactAttach[], at: Date) {
    const id = randomUUID();
    this.rows.push({
      id,
      companyId: app.companyId,
      roleName: app.roleName,
      isManagement: app.isManagement,
      status: app.status,
      listingUrl: app.listingUrl ?? null,
      expectedSalaryIls: app.expectedSalaryIls ?? null,
      source: app.source ?? null,
      applicationMethod: app.applicationMethod ?? null,
      referrerName: app.referrerName ?? null,
      referrerChannel: app.referrerChannel ?? null,
      methodDetails: app.methodDetails ?? null,
      notes: app.notes ?? null,
      appliedAt: app.appliedAt?.toISOString() ?? null,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      nextInterviewAt: null,
      nextInterviewType: null,
      interviewsCount: 0,
      replyBy: app.replyBy?.toISOString() ?? null,
      dueAt: app.dueAt?.toISOString() ?? null,
      nextStep: app.nextStep ?? null,
      snoozedUntil: null,
      statusChangedAt: (app.status === 'applied' && app.appliedAt
        ? app.appliedAt
        : at
      ).toISOString(),
      waitingOnThemAt: null,
      followUps: 0,
      contacts: contacts.filter(isContactInput).map((c) => ({
        id: randomUUID(),
        applicationCount: 1,
        name: c.name,
        role: c.role ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        linkedinUrl: c.linkedinUrl ?? null,
        notes: c.notes ?? null,
      })),
      interviews: [],
      interviewNotes: [],
      history: [
        {
          id: randomUUID(),
          applicationId: id,
          fromStatus: null,
          toStatus: app.status,
          changedAt: at.toISOString(),
          interviewId: null,
        },
      ],
    });
    return id;
  }

  async findById(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    const { companyId, ...rest } = row;
    const company = await this.companies.findById(companyId);
    if (!company) throw new Error('dangling company');
    return { ...structuredClone(rest), company: { ...company } };
  }

  async list(query: ApplicationListQuery) {
    const all = await Promise.all(this.rows.map((r) => this.findById(r.id)));
    return all
      .filter((a): a is ApplicationDetailDto => a !== null)
      .filter((a) => !query.status || a.status === query.status)
      .filter((a) => !query.groups || query.groups.includes(statusGroup(a.status)));
  }

  async getState(id: string) {
    const row = this.rows.find((r) => r.id === id);
    return row
      ? {
          companyId: row.companyId,
          status: row.status,
          appliedAt: row.appliedAt ? new Date(row.appliedAt) : null,
        }
      : null;
  }

  async update(id: string, patch: ApplicationFieldsPatch) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    const { appliedAt, replyBy, dueAt, ...rest } = patch;
    Object.assign(row, rest);
    if (appliedAt !== undefined) row.appliedAt = appliedAt?.toISOString() ?? null;
    if (replyBy !== undefined) row.replyBy = replyBy?.toISOString() ?? null;
    if (dueAt !== undefined) row.dueAt = dueAt?.toISOString() ?? null;
  }

  async recordActivity(
    id: string,
    {
      at,
      appliedAt,
      replyBy,
      dueAt,
    }: { at: Date; appliedAt?: Date | null; replyBy?: Date | null; dueAt?: Date | null },
  ) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    if (appliedAt) row.appliedAt = appliedAt.toISOString();
    row.statusChangedAt = at.toISOString();
    row.waitingOnThemAt = null;
    row.followUps = 0;
    row.snoozedUntil = null;
    row.replyBy = replyBy?.toISOString() ?? null;
    row.dueAt = dueAt?.toISOString() ?? null;
  }

  async snooze(id: string, until: Date) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.snoozedUntil = until.toISOString();
    return !!row;
  }

  async handOver(id: string, reason: HandOverReason, at: Date) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return false;
    row.waitingOnThemAt = at.toISOString();
    if (reason === 'followed_up') row.followUps += 1;
    return true;
  }

  async changeStatus(
    id: string,
    { from, to, appliedAt, at, interviewId, replyBy, dueAt }: StatusTransition,
  ) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    row.status = to;
    row.appliedAt = appliedAt?.toISOString() ?? null;
    row.statusChangedAt = at.toISOString();
    row.waitingOnThemAt = null;
    row.followUps = 0;
    row.snoozedUntil = null;
    row.replyBy = replyBy?.toISOString() ?? null;
    row.dueAt = dueAt?.toISOString() ?? null;
    row.history.push({
      id: randomUUID(),
      applicationId: id,
      fromStatus: from,
      toStatus: to,
      changedAt: at.toISOString(),
      interviewId: interviewId ?? null,
    });
  }

  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
}

/** Records the interviews the service creates; nothing reads them back. */
export class FakeInterviewsRepository {
  created: InterviewDto[] = [];

  async create(applicationId: string, input: InterviewInput): Promise<InterviewDto> {
    const dto: InterviewDto = {
      id: randomUUID(),
      applicationId,
      type: input.type,
      scheduledAt: input.scheduledAt.toISOString(),
      durationMinutes: input.durationMinutes ?? null,
      location: input.location ?? null,
      timeUnknown: input.timeUnknown ?? false,
      debriefedAt: null,
    };
    this.created.push(dto);
    return dto;
  }
}

/** A scored listing ready to insert; override any field. */
export const newOpportunity = (overrides: Partial<NewOpportunity> = {}): NewOpportunity => ({
  listingUrl: `https://jobs.example.com/${randomUUID()}`,
  source: 'fixture',
  companyName: 'Acme',
  title: 'Backend Engineer',
  location: 'Tel Aviv',
  description: 'Build APIs in Node.js.',
  postedAt: null,
  score: 80,
  summary: 'Good match',
  reasons: ['Matches role'],
  isManagement: false,
  companySize: null,
  status: 'new',
  ...overrides,
});

export class FakeOpportunitiesRepository implements OpportunitiesRepository {
  rows: OpportunityDto[] = [];

  async list({ status }: OpportunityListQuery) {
    return this.rows
      .filter((o) => o.status === status)
      .sort((a, b) => b.score - a.score)
      .map((o) => structuredClone(o));
  }
  async findById(id: string) {
    const row = this.rows.find((o) => o.id === id);
    return row ? structuredClone(row) : null;
  }
  async findByUrl(listingUrl: string) {
    const row = this.rows.find((o) => o.listingUrl === listingUrl);
    return row ? structuredClone(row) : null;
  }
  async existingUrls(urls: string[]) {
    return new Set(this.rows.map((o) => o.listingUrl).filter((u) => urls.includes(u)));
  }
  async insertMany(rows: NewOpportunity[]) {
    let inserted = 0;
    for (const r of rows) {
      if (this.rows.some((o) => o.listingUrl === r.listingUrl)) continue;
      const { description: _description, postedAt, ...rest } = r;
      this.rows.push({
        ...rest,
        id: randomUUID(),
        postedAt: postedAt?.toISOString() ?? null,
        applicationId: null,
        createdAt: new Date().toISOString(),
      });
      inserted++;
    }
    return inserted;
  }
  async changeStatus(id: string, { from, to, applicationId }: StatusChange) {
    const row = this.rows.find((o) => o.id === id);
    if (!row || row.status !== from) return false;
    row.status = to;
    if (applicationId !== undefined) row.applicationId = applicationId;
    return true;
  }
}

export class FakeScoutCriteriaRepository implements ScoutCriteriaRepository {
  current: ScoutCriteriaDto = { ...DEFAULT_SCOUT_CRITERIA, updatedAt: null };

  async get() {
    return structuredClone(this.current);
  }
  async save(criteria: ScoutCriteria) {
    this.current = { ...criteria, updatedAt: new Date().toISOString() };
    return this.get();
  }
}
