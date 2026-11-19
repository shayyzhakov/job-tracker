import type { InterviewDto, InterviewInput, InterviewUpdate } from '@job-tracker/shared';
import { BadRequestError, NotFoundError } from '../../errors.js';
import type { ApplicationsRepository } from '../applications/applications.repository.js';
import type { ApplicationsService } from '../applications/applications.service.js';
import { type ChildRepository, ChildService } from '../child-service.js';

export interface InterviewsRepository
  extends ChildRepository<InterviewInput, InterviewUpdate, InterviewDto> {
  find(applicationId: string, id: string): Promise<InterviewDto | null>;
}

/** Interviews are the single record of an interview round; scheduling one makes the application show that round while it is upcoming. */
export class InterviewsService extends ChildService<InterviewInput, InterviewUpdate, InterviewDto> {
  constructor(
    private readonly interviews: InterviewsRepository,
    applicationsRepo: Pick<ApplicationsRepository, 'getState'>,
    private readonly stages: Pick<ApplicationsService, 'onInterviewScheduled'>,
  ) {
    super('Interview', interviews, applicationsRepo);
  }

  override async create(applicationId: string, input: InterviewInput): Promise<InterviewDto> {
    const interview = await super.create(applicationId, input);
    await this.stages.onInterviewScheduled(applicationId, new Date(interview.scheduledAt));
    return interview;
  }

  /** Due and submitted dates are home-assignment only; without a type in the patch, the stored type decides. */
  override async update(
    applicationId: string,
    id: string,
    patch: InterviewUpdate,
  ): Promise<InterviewDto> {
    if (patch.type === undefined && (patch.dueAt != null || patch.submittedAt != null)) {
      const current = await this.interviews.find(applicationId, id);
      if (!current) throw new NotFoundError('Interview', id);
      if (current.type !== 'home_assignment') {
        throw new BadRequestError('Only a home assignment has a due date or a submitted date');
      }
    }
    return super.update(applicationId, id, patch);
  }
}
