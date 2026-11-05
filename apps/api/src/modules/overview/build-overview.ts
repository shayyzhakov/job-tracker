import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  isActiveStatus,
  type OverviewDto,
  type UpcomingInterviewDto,
} from '@job-tracker/shared';

export interface OverviewApplicationRow {
  id: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
  expectedSalaryIls: number | null;
  /** Every status this application has ever had (from status history). */
  reachedStatuses: ApplicationStatus[];
}

export interface OverviewInput {
  applications: OverviewApplicationRow[];
  /** Upcoming interviews, soonest first. */
  upcomingInterviews: UpcomingInterviewDto[];
}

const DAY_MS = 86_400_000;
const WEEKS = 8;
/** Statuses that don't indicate the company responded. */
const NO_RESPONSE: ReadonlySet<ApplicationStatus> = new Set([
  'to_apply',
  'applied',
  'ghosted',
  'withdrawn',
]);

/** Sunday 00:00 UTC of the week containing `d` (Israeli work week starts Sunday). */
function weekStartUtc(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return new Date(day.getTime() - day.getUTCDay() * DAY_MS);
}

/** Pure aggregation: easy to unit-test and independent of the DB. */
export function buildOverview(input: OverviewInput, now: Date): OverviewDto {
  const { applications, upcomingInterviews } = input;

  const countsByStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const a of applications) countsByStatus[a.status]++;

  const active = applications.filter((a) => isActiveStatus(a.status));
  const submitted = applications.filter((a) => a.status !== 'to_apply');
  const responded = submitted.filter((a) => a.reachedStatuses.some((s) => !NO_RESPONSE.has(s)));

  const salaries = active.map((a) => a.expectedSalaryIls).filter((s): s is number => s !== null);

  const currentWeek = weekStartUtc(now).getTime();
  const weeklyApplied = Array.from({ length: WEEKS }, (_, i) => ({
    weekStart: new Date(currentWeek - (WEEKS - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const a of applications) {
    if (!a.appliedAt) continue;
    const weeksBack = Math.round(
      (currentWeek - weekStartUtc(a.appliedAt).getTime()) / (7 * DAY_MS),
    );
    const bucket = weeklyApplied[WEEKS - 1 - weeksBack];
    if (weeksBack >= 0 && bucket) bucket.count++;
  }

  const weekAhead = now.getTime() + 7 * DAY_MS;

  return {
    totalApplications: applications.length,
    activeApplications: active.length,
    countsByStatus,
    responseRate: submitted.length > 0 ? responded.length / submitted.length : null,
    offers: applications.filter((a) => a.reachedStatuses.includes('offer')).length,
    interviewsNext7Days: upcomingInterviews.filter(
      (i) => new Date(i.scheduledAt).getTime() <= weekAhead,
    ).length,
    nextInterview: upcomingInterviews[0] ?? null,
    upcomingInterviews,
    weeklyApplied,
    averageExpectedSalaryIls:
      salaries.length > 0
        ? Math.round(salaries.reduce((sum, s) => sum + s, 0) / salaries.length)
        : null,
  };
}
