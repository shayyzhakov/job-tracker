// In-memory repositories for fast service unit tests (no DB).
import { randomUUID } from 'node:crypto';
import type {
  ApplicationDetailDto,
  ApplicationListQuery,
  CompanyDto,
  CompanyInput,
  ContactInput,
} from '@job-tracker/shared';
import { isActiveStatus } from '@job-tracker/shared';
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
    return this.rows.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  }
}

type StoredApp = Omit<ApplicationDetailDto, 'company'> & { companyId: string };

export class FakeApplicationsRepository implements ApplicationsRepository {
  rows: StoredApp[] = [];
  constructor(private readonly companies: FakeCompaniesRepository) {}

  async insert(app: NewApplication, contacts: ContactInput[], at: Date) {
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
      notes: app.notes ?? null,
      appliedAt: app.appliedAt?.toISOString() ?? null,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      nextInterviewAt: null,
      contacts: contacts.map((c) => ({
        id: randomUUID(),
        applicationId: id,
        name: c.name,
        role: c.role ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        notes: c.notes ?? null,
      })),
      interviews: [],
      history: [
        {
          id: randomUUID(),
          applicationId: id,
          fromStatus: null,
          toStatus: app.status,
          changedAt: at.toISOString(),
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
      .filter((a) => query.active === undefined || isActiveStatus(a.status) === query.active);
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
    const { appliedAt, ...rest } = patch;
    Object.assign(row, rest);
    if (appliedAt !== undefined) row.appliedAt = appliedAt?.toISOString() ?? null;
  }

  async changeStatus(id: string, { from, to, appliedAt, at }: StatusTransition) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    row.status = to;
    row.appliedAt = appliedAt?.toISOString() ?? null;
    row.history.push({
      id: randomUUID(),
      applicationId: id,
      fromStatus: from,
      toStatus: to,
      changedAt: at.toISOString(),
    });
  }

  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
}
