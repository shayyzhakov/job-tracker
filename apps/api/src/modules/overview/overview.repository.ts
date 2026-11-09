import { displayedStatus, type UpcomingInterviewDto } from '@job-tracker/shared';
import { batchGet, type Db, dateOrNull, key, queryGsi1 } from '../../db/dynamo.js';
import {
  type ApplicationItem,
  type CompanyItem,
  type InterviewItem,
  toInterviewDto,
} from '../../db/mappers.js';
import { afterTime, timingByApplication } from '../applications/applications.repository.js';
import type { OverviewInput } from './build-overview.js';

const UPCOMING_LIMIT = 10;

/** Loads the raw rows buildOverview needs. Personal-scale data, so aggregation happens in JS. */
export class DynamoOverviewRepository {
  constructor(private readonly db: Db) {}

  async load(now: Date): Promise<OverviewInput> {
    const [apps, interviews] = await Promise.all([
      queryGsi1<ApplicationItem>(this.db, 'APPS'),
      queryGsi1<InterviewItem>(this.db, 'INTERVIEWS'),
    ]);
    const after = afterTime(now);
    // Earliest first (the index is ordered by time).
    const upcoming = interviews.filter((i) => i.scheduledAt > after).slice(0, UPCOMING_LIMIT);
    const timing = timingByApplication(interviews, after);

    // Names for the upcoming interviews: fetch just the applications (and their companies) involved.
    const involvedApps = await batchGet<ApplicationItem>(
      this.db,
      upcoming.map((i) => key.app(i.applicationId)),
    );
    const appById = new Map(involvedApps.map((a) => [a.id, a]));
    const companies = await batchGet<CompanyItem>(
      this.db,
      involvedApps.map((a) => key.company(a.companyId)),
    );
    const companyById = new Map(companies.map((c) => [c.id, c]));

    return {
      // Counts use the displayed status (see `displayedStatus`), and rounds that were held count as reached.
      applications: apps.map((a) => {
        const t = timing.get(a.id);
        return {
          id: a.id,
          status: displayedStatus({
            status: a.status,
            next: t?.nextStaged ?? null,
            lastPast: t?.lastPast ?? null,
          }),
          appliedAt: dateOrNull(a.appliedAt),
          applicationMethod: a.applicationMethod ?? null,
          expectedSalaryIls: a.expectedSalaryIls,
          reachedStatuses: [...new Set([...a.reachedStatuses, ...(t?.pastStages ?? [])])],
        };
      }),
      upcomingInterviews: upcoming.flatMap((i): UpcomingInterviewDto[] => {
        const app = appById.get(i.applicationId);
        const company = app && companyById.get(app.companyId);
        return app && company
          ? [{ ...toInterviewDto(i), companyName: company.name, roleName: app.roleName }]
          : [];
      }),
    };
  }
}
