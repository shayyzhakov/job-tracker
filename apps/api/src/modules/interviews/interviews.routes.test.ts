import type { ApplicationDetailDto, InterviewDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('interviews API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const url = (appId: string, interviewId?: string) =>
    `/api/v1/applications/${appId}/interviews${interviewId ? `/${interviewId}` : ''}`;
  const getApp = async (id: string) =>
    (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${id}` })
    ).json<ApplicationDetailDto>();

  it('schedules interviews and exposes the next upcoming one on the application', async () => {
    const { id } = await createApplication(t.app);
    for (const [type, days] of [
      ['hr', -3],
      ['technical', 5],
      ['phone', 2],
    ] as const) {
      const res = await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { type, scheduledAt: inDays(days) },
      });
      expect(res.statusCode).toBe(201);
    }
    const detail = await getApp(id);
    expect(detail.interviews.map((i) => i.type)).toEqual(['hr', 'phone', 'technical']);
    expect(detail.nextInterviewAt).toBe(detail.interviews[1]?.scheduledAt);
  });

  it('reschedules and deletes an interview', async () => {
    const { id } = await createApplication(t.app);
    const created = (
      await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { scheduledAt: inDays(1) },
      })
    ).json<InterviewDto>();

    const newDate = inDays(3);
    const patched = await t.app.inject({
      method: 'PATCH',
      url: url(id, created.id),
      payload: { scheduledAt: newDate, notes: 'Bring laptop' },
    });
    expect(patched.json()).toMatchObject({
      scheduledAt: newDate,
      notes: 'Bring laptop',
    });

    expect((await t.app.inject({ method: 'DELETE', url: url(id, created.id) })).statusCode).toBe(
      204,
    );
    expect((await getApp(id)).interviews).toEqual([]);
  });

  it('rejects an invalid date', async () => {
    const { id } = await createApplication(t.app);
    const res = await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { scheduledAt: 'tomorrow-ish' },
    });
    expect(res.statusCode).toBe(400);
  });
});
