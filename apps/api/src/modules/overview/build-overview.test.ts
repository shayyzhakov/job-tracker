import type { ApplicationStatus, UpcomingInterviewDto } from '@job-tracker/shared';
import { describe, expect, it } from 'vitest';
import { buildOverview, type OverviewApplicationRow } from './build-overview.js';

// Thursday 2026-11-05 10:00 UTC; its week starts Sunday 2026-11-01.
const NOW = new Date('2026-11-05T10:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

let seq = 0;
const app = (
  status: ApplicationStatus,
  opts: Partial<Omit<OverviewApplicationRow, 'status'>> = {},
): OverviewApplicationRow => ({
  id: `app-${++seq}`,
  status,
  appliedAt: status === 'to_apply' ? null : daysAgo(1),
  expectedSalaryIls: null,
  reachedStatuses: [status],
  ...opts,
});

const interview = (inDays: number): UpcomingInterviewDto => ({
  id: `int-${++seq}`,
  applicationId: 'x',
  type: 'technical',
  scheduledAt: new Date(NOW.getTime() + inDays * 86_400_000).toISOString(),
  durationMinutes: null,
  location: null,
  notes: null,
  companyName: 'Acme',
  roleName: 'Engineer',
});

describe('buildOverview', () => {
  it('returns zeroed stats for no data', () => {
    const o = buildOverview({ applications: [], upcomingInterviews: [] }, NOW);
    expect(o.totalApplications).toBe(0);
    expect(o.activeApplications).toBe(0);
    expect(o.responseRate).toBeNull();
    expect(o.nextInterview).toBeNull();
    expect(o.averageExpectedSalaryIls).toBeNull();
    expect(o.countsByStatus.applied).toBe(0);
    expect(o.weeklyApplied).toHaveLength(8);
  });

  it('counts totals, active applications and counts by status', () => {
    const o = buildOverview(
      {
        applications: [app('to_apply'), app('applied'), app('applied'), app('rejected')],
        upcomingInterviews: [],
      },
      NOW,
    );
    expect(o.totalApplications).toBe(4);
    expect(o.activeApplications).toBe(3);
    expect(o.countsByStatus).toMatchObject({ to_apply: 1, applied: 2, rejected: 1, offer: 0 });
  });

  it('computes response rate over submitted applications, counting rejections as responses', () => {
    const o = buildOverview(
      {
        applications: [
          app('to_apply'), // not submitted: excluded
          app('applied', { reachedStatuses: ['to_apply', 'applied'] }), // no response
          app('ghosted', { reachedStatuses: ['applied', 'ghosted'] }), // no response
          app('rejected', { reachedStatuses: ['applied', 'rejected'] }), // response
          app('phone_interview', {
            reachedStatuses: ['applied', 'hr_screening', 'phone_interview'],
          }),
        ],
        upcomingInterviews: [],
      },
      NOW,
    );
    expect(o.responseRate).toBe(0.5);
  });

  it('counts applications that ever reached an offer', () => {
    const o = buildOverview(
      {
        applications: [
          app('offer'),
          app('withdrawn', { reachedStatuses: ['applied', 'offer', 'withdrawn'] }),
          app('applied'),
        ],
        upcomingInterviews: [],
      },
      NOW,
    );
    expect(o.offers).toBe(2);
  });

  it('exposes the next interview and counts interviews in the next 7 days', () => {
    const upcoming = [interview(1), interview(3), interview(10)];
    const o = buildOverview({ applications: [], upcomingInterviews: upcoming }, NOW);
    expect(o.nextInterview).toEqual(upcoming[0]);
    expect(o.interviewsNext7Days).toBe(2);
    expect(o.upcomingInterviews).toHaveLength(3);
  });

  it('buckets applied dates into the last 8 Sunday-start weeks, oldest first', () => {
    const o = buildOverview(
      {
        applications: [
          app('applied', { appliedAt: new Date('2026-11-01T08:00:00Z') }), // this week (Sun)
          app('applied', { appliedAt: new Date('2026-11-04T08:00:00Z') }), // this week
          app('applied', { appliedAt: new Date('2026-10-31T23:00:00Z') }), // prev week (Sat)
          app('applied', { appliedAt: new Date('2026-01-01T00:00:00Z') }), // too old
        ],
        upcomingInterviews: [],
      },
      NOW,
    );
    expect(o.weeklyApplied.at(-1)).toEqual({ weekStart: '2026-11-01', count: 2 });
    expect(o.weeklyApplied.at(-2)).toEqual({ weekStart: '2026-10-25', count: 1 });
    expect(o.weeklyApplied[0]?.weekStart).toBe('2026-09-13');
    expect(o.weeklyApplied.reduce((s, w) => s + w.count, 0)).toBe(3);
  });

  it('averages expected salary over active applications only, rounded', () => {
    const o = buildOverview(
      {
        applications: [
          app('applied', { expectedSalaryIls: 40000 }),
          app('phone_interview', { expectedSalaryIls: 45001 }),
          app('rejected', { expectedSalaryIls: 90000 }),
          app('applied'),
        ],
        upcomingInterviews: [],
      },
      NOW,
    );
    expect(o.averageExpectedSalaryIls).toBe(42501);
  });
});
