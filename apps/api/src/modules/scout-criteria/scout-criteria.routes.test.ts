import { DEFAULT_SCOUT_CRITERIA, type ScoutCriteriaDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const URL = '/api/v1/scout/criteria';

describe('scout criteria API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  it('GET returns defaults before anything is saved', async () => {
    const res = await t.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...DEFAULT_SCOUT_CRITERIA, updatedAt: null });
  });

  it('PUT saves the criteria and GET returns them', async () => {
    const payload = {
      roles: ['Backend Engineer', ' Platform Engineer '],
      seniorities: ['senior', 'staff'],
      track: 'ic',
      locations: ['Tel Aviv'],
      companySizes: ['startup', 'scale_up'],
      excludedCompanies: ['Acme'],
      minScore: 70,
    };
    const put = await t.app.inject({ method: 'PUT', url: URL, payload });
    expect(put.statusCode).toBe(200);
    const saved = put.json<ScoutCriteriaDto>();
    expect(saved).toMatchObject({
      ...payload,
      roles: ['Backend Engineer', 'Platform Engineer'],
    });
    expect(saved.updatedAt).not.toBeNull();

    const second = await t.app.inject({
      method: 'PUT',
      url: URL,
      payload: { minScore: 50 },
    });
    expect(second.json<ScoutCriteriaDto>()).toMatchObject({
      roles: [],
      minScore: 50,
    });

    const get = await t.app.inject({ method: 'GET', url: URL });
    expect(get.json<ScoutCriteriaDto>()).toMatchObject({
      minScore: 50,
      track: 'either',
    });
  });

  it('PUT rejects invalid criteria', async () => {
    const res = await t.app.inject({
      method: 'PUT',
      url: URL,
      payload: { minScore: 500 },
    });
    expect(res.statusCode).toBe(400);
  });
});
