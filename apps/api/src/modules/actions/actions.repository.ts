import type { ApplicationDto, InterviewDto } from '@job-tracker/shared';
import { type Db, queryGsi1 } from '../../db/dynamo.js';
import { type InterviewItem, toInterviewDto } from '../../db/mappers.js';
import type { ApplicationsRepository } from '../applications/applications.repository.js';

export interface ActionsSource {
  load(): Promise<{ applications: ApplicationDto[]; interviews: InterviewDto[] }>;
}

/** Active applications plus every interview (past ones decide debriefs and waiting timers). */
export class DynamoActionsRepository implements ActionsSource {
  constructor(
    private readonly db: Db,
    private readonly applications: Pick<ApplicationsRepository, 'list'>,
  ) {}

  async load() {
    const [applications, interviews] = await Promise.all([
      this.applications.list({ groups: ['initial', 'active'] }),
      queryGsi1<InterviewItem>(this.db, 'INTERVIEWS'),
    ]);
    return { applications, interviews: interviews.map(toInterviewDto) };
  }
}
