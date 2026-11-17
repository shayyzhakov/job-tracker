import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestApp } from '../../test/helpers.js';
import { key } from './dynamo.js';
import { migrateRoundTimeline } from './migrate-round-timeline.js';

describe('migrateRoundTimeline', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const put = (Item: Record<string, unknown>) =>
    t.db.doc.send(new PutCommand({ TableName: t.db.table, Item }));
  const get = async (k: { PK: string; SK: string }) =>
    (await t.db.doc.send(new GetCommand({ TableName: t.db.table, Key: k }))).Item;

  it('drops the old application timeline and marks handed-in assignments submitted, idempotently', async () => {
    await put({
      ...key.app('a1'),
      id: 'a1',
      status: 'applied',
      replyBy: '2026-11-20T00:00:00.000Z',
      dueAt: '2026-11-18T00:00:00.000Z',
      nextStep: 'Send portfolio',
      waitingOnThemAt: '2026-11-10T09:00:00.000Z',
    });
    await put({
      ...key.interview('a1', 'old'),
      id: 'old',
      type: 'home_assignment',
      scheduledAt: '2026-11-01T09:00:00.000Z',
    });
    await put({
      ...key.interview('a1', 'latest'),
      id: 'latest',
      type: 'home_assignment',
      scheduledAt: '2026-11-05T09:00:00.000Z',
    });
    await put({
      ...key.interview('a1', 'later'),
      id: 'later',
      type: 'home_assignment',
      scheduledAt: '2026-11-12T09:00:00.000Z',
    });
    await put({ ...key.app('a2'), id: 'a2', status: 'applied' });

    expect(await migrateRoundTimeline(t.db)).toEqual({ cleared: 1, submitted: 1 });
    expect(await migrateRoundTimeline(t.db)).toEqual({ cleared: 0, submitted: 0 });

    const app = await get(key.app('a1'));
    expect(app).not.toHaveProperty('replyBy');
    expect(app).not.toHaveProperty('dueAt');
    expect(app).not.toHaveProperty('nextStep');
    expect((await get(key.interview('a1', 'latest')))?.submittedAt).toBe(
      '2026-11-10T09:00:00.000Z',
    );
    expect(await get(key.interview('a1', 'old'))).not.toHaveProperty('submittedAt');
    expect(await get(key.interview('a1', 'later'))).not.toHaveProperty('submittedAt');
  });
});
