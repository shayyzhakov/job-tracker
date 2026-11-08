import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestApp } from '../../test/helpers.js';
import { key } from './dynamo.js';
import { migrateUnicornToScaleUp } from './migrate-company-sizes.js';

describe('migrateUnicornToScaleUp', () => {
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

  it('renames stored sizes on companies, opportunities and scout criteria, idempotently', async () => {
    await put({ ...key.company('c1'), id: 'c1', name: 'Wix', size: 'unicorn' });
    await put({ ...key.company('c2'), id: 'c2', name: 'Meta', size: 'corporate' });
    await put({ ...key.opportunity('o1'), id: 'o1', companySize: 'unicorn' });
    await put({
      ...key.scoutCriteria(),
      criteria: { companySizes: ['startup', 'unicorn'] },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await migrateUnicornToScaleUp(t.db)).toBe(3);
    expect(await migrateUnicornToScaleUp(t.db)).toBe(0);

    expect((await get(key.company('c1')))?.size).toBe('scale_up');
    expect((await get(key.company('c2')))?.size).toBe('corporate');
    expect((await get(key.opportunity('o1')))?.companySize).toBe('scale_up');
    expect((await get(key.scoutCriteria()))?.criteria).toEqual({
      companySizes: ['startup', 'scale_up'],
    });
  });
});
