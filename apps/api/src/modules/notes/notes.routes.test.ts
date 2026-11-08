import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ApplicationDetailDto, InterviewDto, NoteDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';
import { key } from '../../db/dynamo.js';
import { migrateInterviewNotes } from '../../db/migrate-interview-notes.js';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('interview notes API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const base = (appId: string) => `/api/v1/applications/${appId}`;
  const notesUrl = (appId: string, interviewId: string, id?: string) =>
    `${base(appId)}/interviews/${interviewId}/notes${id ? `/${id}` : ''}`;
  const getApp = async (id: string) =>
    (await t.app.inject({ method: 'GET', url: base(id) })).json<ApplicationDetailDto>();
  const addInterview = async (appId: string, payload: object) =>
    (
      await t.app.inject({ method: 'POST', url: `${base(appId)}/interviews`, payload })
    ).json<InterviewDto>();
  const addNote = async (appId: string, interviewId: string, text: string) =>
    (
      await t.app.inject({
        method: 'POST',
        url: notesUrl(appId, interviewId),
        payload: { text },
      })
    ).json<NoteDto>();

  it('adds multi-line notes to past and upcoming interviews and lists them in the detail, newest first', async () => {
    const { id } = await createApplication(t.app);
    const past = await addInterview(id, { type: 'phone', scheduledAt: inDays(-3) });
    const future = await addInterview(id, { type: 'technical', scheduledAt: inDays(4) });

    const res = await t.app.inject({
      method: 'POST',
      url: notesUrl(id, past.id),
      payload: { text: '  Asked about indexes\nand caching  ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      applicationId: id,
      interviewId: past.id,
      text: 'Asked about indexes\nand caching',
    });
    await new Promise((r) => setTimeout(r, 5));
    await addNote(id, past.id, 'Second note');
    await addNote(id, future.id, 'Prep: ask about the team');

    const detail = await getApp(id);
    expect(detail.interviewNotes).toHaveLength(3);
    expect(
      detail.interviewNotes.filter((n) => n.interviewId === past.id).map((n) => n.text),
    ).toEqual(['Second note', 'Asked about indexes\nand caching']);
    // the future interview keeps its Scheduled state and is not debriefed
    const after = detail.interviews.find((i) => i.id === future.id);
    expect(after).toMatchObject({ scheduledAt: future.scheduledAt, debriefedAt: null });
  });

  it('works on a placeholder-time interview created by a status change', async () => {
    const { id } = await createApplication(t.app);
    await t.app.inject({
      method: 'PATCH',
      url: `${base(id)}/status`,
      payload: { status: 'hr_screening' },
    });
    const [interview] = (await getApp(id)).interviews;
    const res = await t.app.inject({
      method: 'POST',
      url: notesUrl(id, interview?.id as string),
      payload: { text: 'Recruiter said the role is hybrid' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects blank text and unknown interviews', async () => {
    const { id } = await createApplication(t.app);
    const iv = await addInterview(id, { scheduledAt: inDays(1) });
    expect(
      (
        await t.app.inject({
          method: 'POST',
          url: notesUrl(id, iv.id),
          payload: { text: '   ' },
        })
      ).statusCode,
    ).toBe(400);
    const missing = await t.app.inject({
      method: 'POST',
      url: notesUrl(id, crypto.randomUUID()),
      payload: { text: 'x' },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('edits and deletes a note', async () => {
    const { id } = await createApplication(t.app);
    const iv = await addInterview(id, { scheduledAt: inDays(-1) });
    const note = await addNote(id, iv.id, 'first');

    const patched = await t.app.inject({
      method: 'PATCH',
      url: notesUrl(id, iv.id, note.id),
      payload: { text: 'edited' },
    });
    expect(patched.json()).toMatchObject({
      id: note.id,
      text: 'edited',
      createdAt: note.createdAt,
    });
    expect(
      (
        await t.app.inject({
          method: 'PATCH',
          url: notesUrl(id, iv.id, note.id),
          payload: { text: '' },
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (await t.app.inject({ method: 'DELETE', url: notesUrl(id, iv.id, note.id) })).statusCode,
    ).toBe(204);
    expect((await getApp(id)).interviewNotes).toEqual([]);
    expect(
      (await t.app.inject({ method: 'DELETE', url: notesUrl(id, iv.id, note.id) })).statusCode,
    ).toBe(404);
  });

  it('deleting an interview deletes its notes only', async () => {
    const { id } = await createApplication(t.app);
    const a = await addInterview(id, { type: 'phone', scheduledAt: inDays(-5) });
    const b = await addInterview(id, { type: 'technical', scheduledAt: inDays(-2) });
    await addNote(id, a.id, 'a1');
    await addNote(id, a.id, 'a2');
    await addNote(id, b.id, 'b1');

    await t.app.inject({ method: 'DELETE', url: `${base(id)}/interviews/${a.id}` });
    const detail = await getApp(id);
    expect(detail.interviewNotes.map((n) => n.text)).toEqual(['b1']);
  });

  it('deleting an application deletes its notes', async () => {
    const { id } = await createApplication(t.app);
    const iv = await addInterview(id, { scheduledAt: inDays(-1) });
    await addNote(id, iv.id, 'gone');
    expect((await t.app.inject({ method: 'DELETE', url: base(id) })).statusCode).toBe(204);
    const { queryPartition } = await import('../../db/dynamo.js');
    expect(await queryPartition(t.db, `APP#${id}`)).toEqual([]);
  });

  it('migrates legacy single-line notes once', async () => {
    const { id } = await createApplication(t.app);
    const iv = await addInterview(id, { scheduledAt: inDays(-1) });
    await t.db.doc.send(
      new PutCommand({
        TableName: t.db.table,
        Item: {
          ...key.interview(id, iv.id),
          GSI1PK: 'INTERVIEWS',
          GSI1SK: `${iv.scheduledAt}#${iv.id}`,
          ...iv,
          notes: 'Bring laptop',
          createdAt: iv.scheduledAt,
          updatedAt: iv.scheduledAt,
        },
      }),
    );

    expect(await migrateInterviewNotes(t.db)).toBe(1);
    expect(await migrateInterviewNotes(t.db)).toBe(0);

    const detail = await getApp(id);
    expect(detail.interviewNotes).toHaveLength(1);
    expect(detail.interviewNotes[0]).toMatchObject({
      interviewId: iv.id,
      text: 'Bring laptop',
      createdAt: iv.scheduledAt,
    });
    expect(detail.interviews[0]).not.toHaveProperty('notes');
  });
});
