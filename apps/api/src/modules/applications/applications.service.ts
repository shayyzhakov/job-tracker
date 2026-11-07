import type {
  ApplicationCreate,
  ApplicationDetailDto,
  ApplicationListQuery,
  ApplicationStatus,
  ApplicationUpdate,
  CompanyDto,
} from '@job-tracker/shared';
import { NotFoundError } from '../../errors.js';
import type { CompaniesRepository } from '../companies/companies.repository.js';
import type { ApplicationsRepository } from './applications.repository.js';

export interface ApplicationsServiceDeps {
  applications: ApplicationsRepository;
  companies: CompaniesRepository;
  now?: () => Date;
}

export class ApplicationsService {
  private readonly apps: ApplicationsRepository;
  private readonly companies: CompaniesRepository;
  private readonly now: () => Date;

  constructor({ applications, companies, now = () => new Date() }: ApplicationsServiceDeps) {
    this.apps = applications;
    this.companies = companies;
    this.now = now;
  }

  list(query: ApplicationListQuery) {
    return this.apps.list(query);
  }

  async get(id: string): Promise<ApplicationDetailDto> {
    const app = await this.apps.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return app;
  }

  async create(input: ApplicationCreate): Promise<ApplicationDetailDto> {
    const company = await this.resolveCompany(input.company);
    const now = this.now();
    const { company: _company, contacts, appliedAt, ...fields } = input;
    const id = await this.apps.insert(
      {
        ...fields,
        companyId: company.id,
        appliedAt: appliedAt ?? (input.status === 'to_apply' ? null : now),
      },
      contacts,
      now,
    );
    return this.get(id);
  }

  async update(id: string, patch: ApplicationUpdate): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    const { company, ...fields } = patch;
    if (company) await this.companies.update(state.companyId, company);
    await this.apps.update(id, fields);
    return this.get(id);
  }

  async changeStatus(
    id: string,
    status: ApplicationStatus,
    repeat = false,
  ): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    if (state.status !== status || repeat) {
      const now = this.now();
      await this.apps.changeStatus(id, {
        from: state.status,
        to: status,
        appliedAt: state.appliedAt ?? (status === 'to_apply' ? null : now),
        at: now,
      });
    }
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.apps.delete(id))) throw new NotFoundError('Application', id);
  }

  private async requireState(id: string) {
    const state = await this.apps.getState(id);
    if (!state) throw new NotFoundError('Application', id);
    return state;
  }

  private async resolveCompany(ref: ApplicationCreate['company']): Promise<CompanyDto> {
    if ('id' in ref) {
      const found = await this.companies.findById(ref.id);
      if (!found) throw new NotFoundError('Company', ref.id);
      return found;
    }
    return (await this.companies.findByName(ref.name)) ?? this.companies.create(ref);
  }
}
