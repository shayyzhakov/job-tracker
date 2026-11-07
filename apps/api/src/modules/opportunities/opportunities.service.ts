import {
  ApplicationCreateSchema,
  type ApplicationDetailDto,
  normalizeListingUrl,
  type OpportunityCreateInput,
  type OpportunityDto,
  type OpportunityListQuery,
} from '@job-tracker/shared';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { ApplicationsService } from '../applications/applications.service.js';
import type { OpportunitiesRepository } from './opportunities.repository.js';

export interface OpportunitiesServiceDeps {
  opportunities: OpportunitiesRepository;
  applications: ApplicationsService;
}

export const SCOUT_SOURCE_LABEL = 'AI scout';

export class OpportunitiesService {
  private readonly repo: OpportunitiesRepository;
  private readonly applications: ApplicationsService;

  constructor({ opportunities, applications }: OpportunitiesServiceDeps) {
    this.repo = opportunities;
    this.applications = applications;
  }

  list(query: OpportunityListQuery) {
    return this.repo.list(query);
  }

  /** Manually adds a suggestion (status `new`). 409 if the listing URL is already stored. */
  async add(input: OpportunityCreateInput): Promise<OpportunityDto> {
    const listingUrl = normalizeListingUrl(input.listingUrl);
    if (
      !(await this.repo.insertMany([
        {
          listingUrl,
          source: input.source,
          companyName: input.companyName,
          title: input.title,
          location: input.location ?? null,
          description: input.description,
          postedAt: input.postedAt ? new Date(input.postedAt) : null,
          score: input.score,
          summary: input.summary,
          reasons: input.reasons,
          isManagement: input.isManagement,
          companySize: input.companySize ?? null,
          status: 'new',
        },
      ]))
    ) {
      throw new ConflictError(`A suggestion for ${listingUrl} already exists`);
    }
    const created = await this.repo.findByUrl(listingUrl);
    if (!created) throw new NotFoundError('Opportunity', listingUrl);
    return created;
  }

  /** Turns a suggestion into a to_apply application. */
  async promote(id: string): Promise<ApplicationDetailDto> {
    // Claim the suggestion first so concurrent promotes can't create two applications.
    const opp = await this.claim(id, 'promoted');
    let created: ApplicationDetailDto;
    try {
      created = await this.applications.create(
        ApplicationCreateSchema.parse({
          company: {
            name: opp.companyName,
            ...(opp.companySize && { size: opp.companySize }),
          },
          roleName: opp.title,
          isManagement: opp.isManagement,
          listingUrl: opp.listingUrl,
          source: SCOUT_SOURCE_LABEL,
          notes: opp.summary,
        }),
      );
    } catch (err) {
      await this.repo.changeStatus(id, { from: 'promoted', to: 'new' });
      throw err;
    }
    await this.repo.changeStatus(id, {
      from: 'promoted',
      to: 'promoted',
      applicationId: created.id,
    });
    return created;
  }

  async dismiss(id: string): Promise<OpportunityDto> {
    await this.claim(id, 'dismissed');
    const updated = await this.repo.findById(id);
    if (!updated) throw new NotFoundError('Opportunity', id);
    return updated;
  }

  /** Moves a `new` suggestion to `to`, or throws 404 / 409. Returns the suggestion as it was. */
  private async claim(id: string, to: 'promoted' | 'dismissed'): Promise<OpportunityDto> {
    const opp = await this.repo.findById(id);
    if (!opp) throw new NotFoundError('Opportunity', id);
    if (!(await this.repo.changeStatus(id, { from: 'new', to }))) {
      throw new ConflictError(
        `Opportunity ${id} is already ${opp.status === 'new' ? to : opp.status}`,
      );
    }
    return opp;
  }
}
