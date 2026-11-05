import type { ApplicationStatus, UpcomingInterviewDto } from '@job-tracker/shared';
import { asc, eq, gt, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { toInterviewDto } from '../../db/mappers.js';
import { applications, companies, interviews, statusHistory } from '../../db/schema.js';
import type { OverviewInput } from './build-overview.js';

const UPCOMING_LIMIT = 10;

/** Loads the raw rows buildOverview needs. Personal-scale data, so aggregation happens in JS. */
export class DrizzleOverviewRepository {
  constructor(private readonly db: Db) {}

  async load(now: Date): Promise<OverviewInput> {
    const [appRows, upcoming] = await Promise.all([
      this.db
        .select({
          id: applications.id,
          status: applications.status,
          appliedAt: applications.appliedAt,
          expectedSalaryIls: applications.expectedSalaryIls,
          reachedStatuses: sql<ApplicationStatus[]>`coalesce(
            array_agg(distinct ${statusHistory.toStatus}) filter (where ${statusHistory.toStatus} is not null),
            '{}'
          )::text[]`, // text[] so node-postgres parses it (enum arrays arrive as raw strings)
        })
        .from(applications)
        .leftJoin(statusHistory, eq(statusHistory.applicationId, applications.id))
        .groupBy(applications.id),
      this.db
        .select({
          interview: interviews,
          companyName: companies.name,
          roleName: applications.roleName,
        })
        .from(interviews)
        .innerJoin(applications, eq(interviews.applicationId, applications.id))
        .innerJoin(companies, eq(applications.companyId, companies.id))
        .where(gt(interviews.scheduledAt, now))
        .orderBy(asc(interviews.scheduledAt))
        .limit(UPCOMING_LIMIT),
    ]);

    return {
      applications: appRows,
      upcomingInterviews: upcoming.map(
        (r): UpcomingInterviewDto => ({
          ...toInterviewDto(r.interview),
          companyName: r.companyName,
          roleName: r.roleName,
        }),
      ),
    };
  }
}
