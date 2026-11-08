import {
  type CompanyApplicationDto,
  type CompanyDetailDto,
  type CompanyDto,
  type CompanyInput,
  type CompanyUpdate,
  type CompanyWithCountsDto,
  isActiveStatus,
} from '@job-tracker/shared';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { CompaniesRepository } from './companies.repository.js';

const counts = (apps: CompanyApplicationDto[] = []) => ({
  activeApplications: apps.filter((a) => isActiveStatus(a.status)).length,
  totalApplications: apps.length,
});

/**
 * Company management. Applications reference a company by id, so editing a company here changes it
 * everywhere. Application counts are derived on read from the applications, never stored.
 */
export class CompaniesService {
  constructor(private readonly repo: CompaniesRepository) {}

  /** Plain name search (no counts), used to look up a company by name. */
  search(q?: string): Promise<CompanyDto[]> {
    return this.repo.search(q);
  }

  async list(q?: string): Promise<CompanyWithCountsDto[]> {
    const [companies, byCompany] = await Promise.all([
      this.repo.list(q),
      this.repo.applicationsByCompany(),
    ]);
    return companies.map((c) => ({ ...c, ...counts(byCompany.get(c.id)) }));
  }

  async get(id: string): Promise<CompanyDetailDto> {
    const company = await this.repo.findById(id);
    if (!company) throw new NotFoundError('Company', id);
    const applications = (await this.repo.applicationsByCompany()).get(id) ?? [];
    return { ...company, ...counts(applications), applications };
  }

  async create(input: CompanyInput): Promise<CompanyWithCountsDto> {
    const company = await this.repo.create(input);
    return { ...company, ...counts() };
  }

  async update(id: string, patch: CompanyUpdate): Promise<CompanyDetailDto> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Company', id);
    await this.repo.update(id, patch);
    return this.get(id);
  }

  /** Only a company with no applications at all (open or closed) can be deleted. */
  async remove(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Company', id);
    const total = (await this.repo.applicationsByCompany()).get(id)?.length ?? 0;
    if (total > 0) {
      throw new ConflictError(
        `Company has ${total} application${total === 1 ? '' : 's'} and cannot be deleted. Delete the application${total === 1 ? '' : 's'} first.`,
      );
    }
    await this.repo.delete(id);
  }
}
