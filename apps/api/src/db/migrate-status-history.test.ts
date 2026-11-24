import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ApplicationStatus } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestApp } from '../../test/helpers.js';
import { key } from './dynamo.js';
import { migrateStatusHistory } from './migrate-status-history.js';

describe('migrateStatusHistory', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const put = (Item: Record<string, unknown>) =>
    t.db.doc.send(new PutCommand({ TableName: t.db.table, Item }));
  const history = async (appId: string) =>
    (
      await t.db.doc.send(
        new QueryCommand({
          TableName: t.db.table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :h)',
          ExpressionAttributeValues: { ':pk': `APP#${appId}`, ':h': 'HISTORY#' },
        }),
      )
    ).Items?.map((h) => [h.fromStatus, h.toStatus]);

  const seed = async (appId: string, reached: ApplicationStatus[], path: ApplicationStatus[]) => {
    await put({ ...key.app(appId), id: appId, roleName: 'Engineer', reachedStatuses: reached });
    for (const [i, to] of path.entries()) {
      const at = `2026-11-0${i + 1}T10:00:00.000Z`;
      await put({
        ...key.history(appId, at, `h${i}`),
        id: `h${i}`,
        applicationId: appId,
        fromStatus: i === 0 ? null : path[i - 1],
        toStatus: to,
        changedAt: at,
      });
    }
  };

  it('reports in a dry run, then rewrites illogical histories, idempotently', async () => {
    await seed('a1', ['applied', 'ghosted', 'rejected'], ['applied', 'ghosted', 'rejected']);
    await seed(
      'a2',
      ['to_apply', 'applied', 'phone_interview'],
      ['to_apply', 'applied', 'to_apply', 'on_hold'],
    );
    await seed('a3', ['to_apply', 'applied', 'offer'], ['to_apply', 'applied', 'offer']);

    const dry = await migrateStatusHistory(t.db, { write: false });
    expect(dry.map((c) => [c.applicationId, c.after])).toEqual(
      expect.arrayContaining([
        ['a1', ['applied', 'rejected']],
        ['a2', ['to_apply', 'on_hold']],
      ]),
    );
    expect(dry).toHaveLength(2);
    expect(await history('a1')).toHaveLength(3);

    expect(await migrateStatusHistory(t.db, { write: true })).toHaveLength(2);
    expect(await migrateStatusHistory(t.db, { write: true })).toHaveLength(0);

    expect(await history('a1')).toEqual([
      [null, 'applied'],
      ['applied', 'rejected'],
    ]);
    expect(await history('a2')).toEqual([
      [null, 'to_apply'],
      ['to_apply', 'on_hold'],
    ]);
    const a2 = await t.db.doc.send(new GetCommand({ TableName: t.db.table, Key: key.app('a2') }));
    expect(a2.Item?.reachedStatuses).toEqual(['phone_interview', 'to_apply', 'on_hold']);
    expect(await history('a3')).toHaveLength(3);
  });
});
