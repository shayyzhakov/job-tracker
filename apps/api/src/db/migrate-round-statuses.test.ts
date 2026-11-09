import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../test/helpers.js';
import { key } from './dynamo.js';
import { migrateRoundStatuses } from './migrate-round-statuses.js';

describe('migrateRoundStatuses', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const get = async (id: string) =>
    (await t.app.inject({ method: 'GET', url: `/api/v1/applications/${id}` })).json();

  it('resets a stored round to applied and keeps the round as a placeholder interview', async () => {
    const { id } = await createApplication(t.app);
    // simulate the old model: the round was stored on the application, with no interview
    const raw = await t.db.doc.send(
      new GetCommand({
        TableName: t.db.table,
        Key: key.app(id),
      }),
    );
    await t.db.doc.send(
      new PutCommand({
        TableName: t.db.table,
        Item: { ...raw.Item, status: 'technical_interview' },
      }),
    );
    expect(await migrateRoundStatuses(t.db)).toBe(1);
    expect(await migrateRoundStatuses(t.db)).toBe(0);
    const app = await get(id);
    expect(app.status).toBe('technical_interview');
    expect(app.interviews).toMatchObject([{ type: 'technical', timeUnknown: true }]);
  });

  it('adds nothing when a staged interview already exists', async () => {
    const { id } = await createApplication(t.app);
    await t.app.inject({
      method: 'POST',
      url: `/api/v1/applications/${id}/interviews`,
      payload: { type: 'coffee', scheduledAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    const raw = await t.db.doc.send(
      new GetCommand({
        TableName: t.db.table,
        Key: key.app(id),
      }),
    );
    await t.db.doc.send(
      new PutCommand({ TableName: t.db.table, Item: { ...raw.Item, status: 'hr_screening' } }),
    );
    expect(await migrateRoundStatuses(t.db)).toBe(1);
    const app = await get(id);
    expect(app.status).toBe('coffee_chat');
    expect(app.interviews).toHaveLength(1);
  });
});
