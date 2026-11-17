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
    expect(
      (await changeStatus(offer.id, { status: 'offer', offerExpiresAt: inHours(30) })).statusCode,
    ).toBe(200);

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
    const afterSubmit = submitted.json<ApplicationDetailDto>();
    expect(afterSubmit).toMatchObject({ followUps: 0, currentRound: { phase: 'ended' } });
    expect(afterSubmit.interviews[0]?.submittedAt).not.toBeNull();
    expect(afterSubmit.interviews[0]?.dueAt).not.toBeNull();
    const a = await actions();
    expect(a.needsYou).toEqual([]);
    expect(a.waiting).toHaveLength(1);

    const followed = await post(app.id, 'hand-over', { reason: 'followed_up' });
    expect(followed.json<ApplicationDetailDto>().followUps).toBe(1);

    await changeStatus(app.id, { status: 'onsite_interview' });
    const reset = (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` })
    ).json<ApplicationDetailDto>();
    expect(reset).toMatchObject({ followUps: 0, waitingOnThemAt: null });
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

  it('stores the offer expiry on the application and clears it with null', async () => {
    const app = await createApplication(t.app);
    await changeStatus(app.id, { status: 'offer', offerExpiresAt: inHours(48) });
    const set = await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` });
    expect(set.json<ApplicationDetailDto>().offerExpiresAt).not.toBeNull();

    const cleared = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}`,
      payload: { offerExpiresAt: null },
    });
    expect(cleared.json<ApplicationDetailDto>().offerExpiresAt).toBeNull();
  });

  it('keeps the timeline on the round and drops the next step once the round ends', async () => {
    const app = await createApplication(t.app);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/applications/${app.id}/interviews`,
      payload: { type: 'phone', scheduledAt: inHours(30), nextStep: 'Prep questions' },
    });
    const phone = res.json<{ id: string; nextStep: string | null }>();
    expect(phone.nextStep).toBe('Prep questions');
    expect((await actions()).scheduled[0]).toMatchObject({ nextStep: 'Prep questions' });
    const upcoming = (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` })
    ).json<ApplicationDetailDto>();
    expect(upcoming.currentRound).toEqual({ interviewId: phone.id, phase: 'upcoming' });

    await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${app.id}/interviews/${phone.id}`,
      payload: { scheduledAt: inHours(-3), replyBy: inHours(72) },
    });
    const ended = (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` })
    ).json<ApplicationDetailDto>();
    expect(ended.currentRound).toEqual({ interviewId: phone.id, phase: 'ended' });
    expect(ended.interviews[0]).toMatchObject({ nextStep: 'Prep questions' });
    expect((await actions()).waiting[0]?.subtitle).toContain('they said by');
  });

  it('accepts a due date only on a home assignment', async () => {
    const app = await createApplication(t.app);
    const create = (payload: Record<string, unknown>) =>
      t.app.inject({
        method: 'POST',
        url: `/api/v1/applications/${app.id}/interviews`,
        payload,
      });
    const patch = (id: string, payload: Record<string, unknown>) =>
      t.app.inject({
        method: 'PATCH',
        url: `/api/v1/applications/${app.id}/interviews/${id}`,
        payload,
      });

    expect(
      (await create({ type: 'phone', scheduledAt: inHours(5), dueAt: inHours(48) })).statusCode,
    ).toBe(400);
    const phone = (await create({ type: 'phone', scheduledAt: inHours(5) })).json<{ id: string }>();
    expect((await patch(phone.id, { dueAt: inHours(48) })).statusCode).toBe(400);

    const assignment = (
      await create({ type: 'home_assignment', scheduledAt: inHours(-1), dueAt: inHours(48) })
    ).json<{ id: string; dueAt: string | null }>();
    expect(assignment.dueAt).not.toBeNull();
    const retyped = await patch(assignment.id, { type: 'technical' });
    expect(retyped.json<{ dueAt: string | null }>().dueAt).toBeNull();
  });
});
