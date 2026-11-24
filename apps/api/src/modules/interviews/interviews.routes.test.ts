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
    // neither round has happened yet
    expect((await getApp(id)).interviewsCount).toBe(0);
  });

  it('counts every held interview with a stage, so repeated rounds add up', async () => {
    const { id } = await createApplication(t.app);
    for (const [type, days] of [
      ['phone', -4],
      ['phone', -1],
      ['other', -2],
      ['technical', 3],
    ] as const) {
      await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { type, scheduledAt: inDays(days) },
      });
    }
    expect((await getApp(id)).interviewsCount).toBe(2);
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

  it('is one record per round, and the displayed status follows the next upcoming interview', async () => {
    const { id } = await createApplication(t.app);
    const when = inDays(3);
    const moved = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/applications/${id}/status`,
      payload: { status: 'technical_interview', interviewAt: when },
    });
    const afterMove = moved.json<ApplicationDetailDto>();
    expect(afterMove.interviews).toMatchObject([{ type: 'technical', scheduledAt: when }]);

    // a scheduled interview shows as the status without rewriting the history
    const final = await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'final', scheduledAt: inDays(6) },
    });
    const finalId = final.json<{ id: string }>().id;
    const detail = await getApp(id);
    expect(detail.interviews).toHaveLength(2);
    expect(detail.history).toHaveLength(1);
    // the earliest upcoming round wins
    expect(detail.status).toBe('technical_interview');

    // an earlier stage can be next, even after a later one was scheduled
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'hr', scheduledAt: inDays(1) },
    });
    expect((await getApp(id)).status).toBe('hr_screening');

    // an interview without a stage never changes the displayed status
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'other', scheduledAt: inDays(0.5) },
    });
    expect((await getApp(id)).status).toBe('hr_screening');
    expect(finalId).toBeTruthy();
  });

  it('shows the last held round while nothing is scheduled, and reverts when a scheduled one is removed', async () => {
    const { id } = await createApplication(t.app);
    await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'phone', scheduledAt: inDays(-2) },
    });
    expect((await getApp(id)).status).toBe('phone_interview');

    const tech = await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { type: 'technical', scheduledAt: inDays(4) },
    });
    expect((await getApp(id)).status).toBe('technical_interview');
    expect((await getApp(id)).nextInterviewType).toBe('technical');

    await t.app.inject({ method: 'DELETE', url: `${url(id)}/${tech.json<{ id: string }>().id}` });
    expect((await getApp(id)).status).toBe('phone_interview');
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
      payload: { scheduledAt: newDate, location: 'Office' },
    });
    expect(patched.json()).toMatchObject({
      scheduledAt: newDate,
      location: 'Office',
    });

    expect((await t.app.inject({ method: 'DELETE', url: url(id, created.id) })).statusCode).toBe(
      204,
    );
    expect((await getApp(id)).interviews).toEqual([]);
  });

  describe('interviewers', () => {
    const addContact = async (appId: string, name: string) =>
      (
        await t.app.inject({
          method: 'POST',
          url: `/api/v1/applications/${appId}/contacts`,
          payload: { name },
        })
      ).json<{ id: string }>().id;

    it('links several contacts to a round, and one contact to several rounds', async () => {
      const { id } = await createApplication(t.app);
      const dana = await addContact(id, 'Dana');
      const omer = await addContact(id, 'Omer');
      const first = await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { type: 'technical', scheduledAt: inDays(1), interviewerIds: [omer, dana, omer] },
      });
      expect(first.statusCode).toBe(201);
      // repeats are dropped, order is kept
      expect(first.json<InterviewDto>().interviewerIds).toEqual([omer, dana]);
      const second = (
        await t.app.inject({
          method: 'POST',
          url: url(id),
          payload: { type: 'final', scheduledAt: inDays(5), interviewerIds: [dana] },
        })
      ).json<InterviewDto>();
      const none = (
        await t.app.inject({ method: 'POST', url: url(id), payload: { scheduledAt: inDays(7) } })
      ).json<InterviewDto>();
      expect(none.interviewerIds).toEqual([]);

      const app = await getApp(id);
      expect(app.interviews.map((i) => i.interviewerIds)).toEqual([[omer, dana], [dana], []]);

      const patched = await t.app.inject({
        method: 'PATCH',
        url: url(id, second.id),
        payload: { interviewerIds: [] },
      });
      expect(patched.json<InterviewDto>().interviewerIds).toEqual([]);
    });

    it('attaches a known contact from another application to this one', async () => {
      const other = await createApplication(t.app, { company: { name: 'Other' } });
      const dana = await addContact(other.id, 'Dana');
      const { id } = await createApplication(t.app);
      const interview = (
        await t.app.inject({ method: 'POST', url: url(id), payload: { scheduledAt: inDays(1) } })
      ).json<InterviewDto>();
      const res = await t.app.inject({
        method: 'PATCH',
        url: url(id, interview.id),
        payload: { interviewerIds: [dana] },
      });
      expect(res.json<InterviewDto>().interviewerIds).toEqual([dana]);
      const app = await getApp(id);
      expect(app.contacts).toMatchObject([{ id: dana, applicationCount: 2 }]);
    });

    it('404s on an unknown contact or interview, and rejects a non-uuid id', async () => {
      const { id } = await createApplication(t.app);
      const unknown = '00000000-0000-4000-8000-000000000000';
      const create = await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { scheduledAt: inDays(1), interviewerIds: [unknown] },
      });
      expect(create.statusCode).toBe(404);
      expect((await getApp(id)).interviews).toEqual([]);
      const dana = await addContact(id, 'Dana');
      const patch = await t.app.inject({
        method: 'PATCH',
        url: url(id, unknown),
        payload: { interviewerIds: [dana] },
      });
      expect(patch.statusCode).toBe(404);
      const bad = await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { scheduledAt: inDays(1), interviewerIds: ['dana'] },
      });
      expect(bad.statusCode).toBe(400);
    });

    it("removing a contact from the application takes it off that application's interviews", async () => {
      const other = await createApplication(t.app, { company: { name: 'Other' } });
      const { id } = await createApplication(t.app);
      const dana = await addContact(id, 'Dana');
      const omer = await addContact(id, 'Omer');
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/applications/${other.id}/contacts`,
        payload: { contactId: dana },
      });
      const otherRound = (
        await t.app.inject({
          method: 'POST',
          url: url(other.id),
          payload: { scheduledAt: inDays(2), interviewerIds: [dana] },
        })
      ).json<InterviewDto>();
      await t.app.inject({
        method: 'POST',
        url: url(id),
        payload: { scheduledAt: inDays(1), interviewerIds: [dana, omer] },
      });
      const del = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/applications/${id}/contacts/${dana}`,
      });
      expect(del.statusCode).toBe(204);
      expect((await getApp(id)).interviews[0]?.interviewerIds).toEqual([omer]);
      // the other application keeps Dana as its interviewer
      const kept = (await getApp(other.id)).interviews.find((i) => i.id === otherRound.id);
      expect(kept?.interviewerIds).toEqual([dana]);
    });
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
