import type { OverviewDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('GET /api/v1/overview', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  it('aggregates applications, history and upcoming interviews from the DB', async () => {
    const a = await createApplication(t.app, { expectedSalaryIls: 40000 });
    await createApplication(t.app, {
      company: { name: 'Globex' },
      status: 'to_apply',
    });
    const c = await createApplication(t.app, { company: { name: 'Initech' } });

    await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${c.id}/status`,
      payload: { status: 'offer' },
    });
    await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${c.id}/status`,
      payload: { status: 'rejected' },
    });
    for (const days of [-1, 2, 9]) {
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/applications/${a.id}/interviews`,
        payload: { type: 'technical', scheduledAt: inDays(days) },
      });
    }

    const res = await t.app.inject({ method: 'GET', url: '/api/v1/overview' });
    expect(res.statusCode).toBe(200);
    const o = res.json<OverviewDto>();
    expect(o).toMatchObject({
      totalApplications: 3,
      openApplications: 2,
      inProgressApplications: 1,
      offers: 1,
      responseRate: 1,
      interviewsNext7Days: 1,
      averageExpectedSalaryIls: 40000,
    });
    // scheduling a technical interview moved `a` from applied to that stage
    expect(o.countsByStatus).toMatchObject({
      technical_interview: 1,
      to_apply: 1,
      rejected: 1,
    });
    expect(o.upcomingInterviews).toHaveLength(2);
    expect(o.nextInterview).toMatchObject({
      companyName: 'Acme',
      roleName: 'Engineer',
    });
    expect(o.weeklyApplied.at(-1)?.count).toBe(2);
  });
});
