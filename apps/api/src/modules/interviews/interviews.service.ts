import type { InterviewDto, InterviewInput, InterviewUpdate } from '@job-tracker/shared';
import type { ApplicationsRepository } from '../applications/applications.repository.js';
import type { ApplicationsService } from '../applications/applications.service.js';
import { type ChildRepository, ChildService } from '../child-service.js';

/** Interviews are the single record of an interview round; scheduling one makes the application show that round while it is upcoming. */
export class InterviewsService extends ChildService<InterviewInput, InterviewUpdate, InterviewDto> {
  constructor(
    repo: ChildRepository<InterviewInput, InterviewUpdate, InterviewDto>,
    applicationsRepo: Pick<ApplicationsRepository, 'getState'>,
    private readonly stages: Pick<ApplicationsService, 'onInterviewScheduled'>,
  ) {
    super('Interview', repo, applicationsRepo);
  }

  override async create(applicationId: string, input: InterviewInput): Promise<InterviewDto> {
    const interview = await super.create(applicationId, input);
    await this.stages.onInterviewScheduled(applicationId);
    return interview;
  }
}
