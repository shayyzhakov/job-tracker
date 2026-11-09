import type { TimelineInterviewDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('GET /api/v1/timeline', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const schedule = (applicationId: string, type: string, scheduledAt: string) =>
    t.app.inject({
      method: 'POST',
      url: `/api/v1/applications/${applicationId}/interviews`,
      payload: { type, scheduledAt },
    });

  it('returns interviews of all applications in the window, earliest first, with names', async () => {
    const a = await createApplication(t.app, {});
    const b = await createApplication(t.app, { company: { name: 'Globex' } });
    await schedule(a.id, 'technical', inDays(5));
    await schedule(b.id, 'phone', inDays(-3));
    await schedule(a.id, 'final', inDays(60)); // outside the window

    const res = await t.app.inject({
      method: 'GET',
      url: `/api/v1/timeline?from=${encodeURIComponent(inDays(-14))}&to=${encodeURIComponent(inDays(30))}`,
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json<TimelineInterviewDto[]>();
    expect(rows.map((r) => [r.companyName, r.type])).toEqual([
      ['Globex', 'phone'],
      ['Acme', 'technical'],
    ]);
    expect(rows[0]).toMatchObject({ applicationId: b.id, roleName: 'Engineer' });
  });

  it('is open-ended without `to`', async () => {
    const a = await createApplication(t.app, {});
    await schedule(a.id, 'final', inDays(400));
    const res = await t.app.inject({
      method: 'GET',
      url: `/api/v1/timeline?from=${encodeURIComponent(inDays(-7))}`,
    });
    expect(res.json<TimelineInterviewDto[]>()).toHaveLength(1);
  });

  it('requires `from`', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/timeline' });
    expect(res.statusCode).toBe(400);
  });
});
