import type { ActionsDto, ApplicationDetailDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('action queue', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const actions = async () =>
    (await t.app.inject({ method: 'GET', url: '/api/v1/actions' })).json<ActionsDto>();
  const post = async (id: string, path: string, payload: Record<string, unknown>) =>
    await t.app.inject({ method: 'POST', url: `/api/v1/applications/${id}/${path}`, payload });
  const changeStatus = async (id: string, payload: Record<string, unknown>) =>
    await t.app.inject({ method: 'PATCH', url: `/api/v1/applications/${id}/status`, payload });

  it('is empty when nothing needs the user', async () => {
    await createApplication(t.app);
    const a = await actions();
    expect(a.needsYou).toEqual([]);
    expect(a.waiting).toHaveLength(1);
    expect(a.counts).toEqual({ needsYou: 0, overdue: 0, waiting: 1 });
  });

  it('ranks an offer with an expiry first and a to-apply nudge after it', async () => {
    await createApplication(t.app, { company: { name: 'Nudge' }, status: 'to_apply' });
    const offer = await createApplication(t.app, { company: { name: 'Offerco' } });
    expect((await changeStatus(offer.id, { status: 'offer', dueAt: inHours(30) })).statusCode).toBe(
      200,
    );

    const a = await actions();
    expect(a.needsYou.map((x) => [x.company, x.kind, x.urgency])).toEqual([
      ['Offerco', 'respond_offer', 'deadline'],
      ['Nudge', 'apply', 'nudge'],
    ]);
    expect(a.counts.needsYou).toBe(2);
  });

  it('asks to schedule a round moved without a time, and lists it as scheduled once a real time is set', async () => {
    const app = await createApplication(t.app);
    const moved = await changeStatus(app.id, { status: 'phone_interview' });
    expect((await actions()).needsYou[0]).toMatchObject({ kind: 'schedule_interview' });

    const interviewId = moved.json<ApplicationDetailDto>().interviews[0]?.id;
    await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}/interviews/${interviewId}`,
      payload: { scheduledAt: inHours(20), timeUnknown: false },
    });
    const a = await actions();
    expect(a.needsYou).toEqual([]);
    expect(a.scheduled).toHaveLength(1);
  });

  it('hides a snoozed card and shows it under waiting', async () => {
    const app = await createApplication(t.app, { status: 'to_apply' });
    expect((await actions()).needsYou).toHaveLength(1);

    const res = await post(app.id, 'snooze', { until: inHours(24) });
    expect(res.statusCode).toBe(200);
    expect(res.json<ApplicationDetailDto>().snoozedUntil).not.toBeNull();

    const a = await actions();
    expect(a.needsYou).toEqual([]);
    expect(a.waiting[0]?.subtitle).toContain('Snoozed');
  });

  it('hands the ball over, counts follow-ups, and resets on a status change', async () => {
    const app = await createApplication(t.app);
    await changeStatus(app.id, { status: 'home_assignment', dueAt: inHours(48) });
    expect((await actions()).needsYou[0]).toMatchObject({ kind: 'submit_assignment' });

    const submitted = await post(app.id, 'hand-over', { reason: 'submitted' });
    expect(submitted.json<ApplicationDetailDto>()).toMatchObject({ followUps: 0 });
    const a = await actions();
    expect(a.needsYou).toEqual([]);
    expect(a.waiting).toHaveLength(1);

    const followed = await post(app.id, 'hand-over', { reason: 'followed_up' });
    expect(followed.json<ApplicationDetailDto>().followUps).toBe(1);

    await changeStatus(app.id, { status: 'onsite_interview' });
    const reset = (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` })
    ).json<ApplicationDetailDto>();
    expect(reset).toMatchObject({ followUps: 0, waitingOnThemAt: null, dueAt: null });
  });

  it('marks an interview debriefed and returns 404 for unknown applications', async () => {
    const app = await createApplication(t.app);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/applications/${app.id}/interviews`,
      payload: { type: 'phone', scheduledAt: inHours(-30) },
    });
    const interview = res.json<{ id: string; debriefedAt: string | null }>();
    expect(interview.debriefedAt).toBeNull();
    expect((await actions()).needsYou[0]).toMatchObject({ kind: 'debrief' });

    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}/interviews/${interview.id}`,
      payload: { debriefed: true },
    });
    expect(patched.json<{ debriefedAt: string | null }>().debriefedAt).not.toBeNull();
    expect((await actions()).needsYou).toEqual([]);

    const missing = await post('00000000-0000-4000-8000-000000000000', 'snooze', {
      until: inHours(1),
    });
    expect(missing.statusCode).toBe(404);
  });

  it('stores replyBy, dueAt and nextStep through PATCH and clears them with null', async () => {
    const app = await createApplication(t.app);
    const set = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}`,
      payload: { replyBy: inHours(72), dueAt: inHours(24), nextStep: 'Send portfolio' },
    });
    expect(set.json<ApplicationDetailDto>()).toMatchObject({ nextStep: 'Send portfolio' });
    expect(set.json<ApplicationDetailDto>().replyBy).not.toBeNull();

    const cleared = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}`,
      payload: { replyBy: null, dueAt: null, nextStep: null },
    });
    expect(cleared.json<ApplicationDetailDto>()).toMatchObject({
      replyBy: null,
      dueAt: null,
      nextStep: null,
    });
  });
});
