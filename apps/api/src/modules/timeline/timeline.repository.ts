import type { TimelineInterviewDto } from '@job-tracker/shared';
import { batchGet, type Db, iso, key, queryGsi1 } from '../../db/dynamo.js';
import {
  type ApplicationItem,
  type CompanyItem,
  type InterviewItem,
  toInterviewDto,
} from '../../db/mappers.js';

/** Reads interviews of every application in a time window (GSI1 is ordered by time). */
export class DynamoTimelineRepository {
  constructor(private readonly db: Db) {}

  async list(from: Date, to?: Date): Promise<TimelineInterviewDto[]> {
    const items = await queryGsi1<InterviewItem>(this.db, 'INTERVIEWS', {
      // Without `to` the window is open-ended. '~' sorts after the '#' that separates the id, so `to` is inclusive.
      skCondition: to ? 'GSI1SK BETWEEN :from AND :to' : 'GSI1SK >= :from',
      values: { ':from': iso(from), ...(to && { ':to': `${iso(to)}~` }) },
    });
    // A round without a real time only has a placeholder date: it does not belong on a calendar.
    const dated = items.filter((i) => !i.timeUnknown);

    const apps = await batchGet<ApplicationItem>(
      this.db,
      [...new Set(dated.map((i) => i.applicationId))].map((id) => key.app(id)),
    );
    const appById = new Map(apps.map((a) => [a.id, a]));
    const companies = await batchGet<CompanyItem>(
      this.db,
      [...new Set(apps.map((a) => a.companyId))].map((id) => key.company(id)),
    );
    const companyById = new Map(companies.map((c) => [c.id, c]));

    return dated.flatMap((i): TimelineInterviewDto[] => {
      const app = appById.get(i.applicationId);
      const company = app && companyById.get(app.companyId);
      return app && company
        ? [{ ...toInterviewDto(i), companyName: company.name, roleName: app.roleName }]
        : [];
    });
  }
}
