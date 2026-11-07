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

  it('does not count a round in interviewsCount until its interview has happened', async () => {
    const { id } = await createApplication(t.app);
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'hr', scheduledAt: inDays(2) },
    });
    expect((await getApp(id)).interviewsCount).toBe(0);
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'technical', scheduledAt: inDays(5) },
    });
    // hr round moved on to technical: hr counted, upcoming technical not yet
    expect((await getApp(id)).interviewsCount).toBe(1);
  });

  it('counts a round once it has a past interview, even with a follow-up scheduled', async () => {
    const { id } = await createApplication(t.app);
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'hr', scheduledAt: inDays(-3) },
    });
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'hr', scheduledAt: inDays(2) },
    });
    expect((await getApp(id)).interviewsCount).toBe(1);
  });

  it('is one record per round: a status change creates it, a scheduled one advances the status', async () => {
    const { id } = await createApplication(t.app);
    const when = inDays(3);
    const moved = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${id}/status`,
      payload: { status: 'technical_interview', interviewAt: when },
    });
    const afterMove = moved.json<ApplicationDetailDto>();
    expect(afterMove.interviews).toMatchObject([{ type: 'technical', scheduledAt: when }]);
    expect(afterMove.history.at(-1)?.interviewId).toBe(afterMove.interviews[0]?.id);

    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'final', scheduledAt: inDays(6) },
    });
    const detail = await getApp(id);
    expect(detail.status).toBe('final_interview');
    expect(detail.interviews).toHaveLength(2);
    expect(detail.history.at(-1)?.interviewId).toBe(detail.interviews[1]?.id);

    // an earlier-stage interview doesn't pull the status back
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'hr', scheduledAt: inDays(-1) },
    });
    expect((await getApp(id)).status).toBe('final_interview');
  });

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
