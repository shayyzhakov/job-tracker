import type { ApplicationDetailDto, OpportunityDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newOpportunity } from '../../../test/fakes.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';
import { DynamoOpportunitiesRepository } from './opportunities.repository.js';

const BASE = '/api/v1/opportunities';

describe('opportunities API', () => {
  let t: TestApp;
  let repo: DynamoOpportunitiesRepository;
  beforeAll(async () => {
    t = await createTestApp();
    repo = new DynamoOpportunitiesRepository(t.db);
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const list = async (query = '') => {
    const res = await t.app.inject({ method: 'GET', url: `${BASE}${query}` });
    expect(res.statusCode).toBe(200);
    return res.json<OpportunityDto[]>();
  };

  it('GET lists new suggestions by default, best score first', async () => {
    await repo.insertMany([
      newOpportunity({ listingUrl: 'https://x.com/low', score: 61 }),
      newOpportunity({
        listingUrl: 'https://x.com/high',
        score: 92,
        reasons: ['Node.js', 'TLV'],
      }),
      newOpportunity({
        listingUrl: 'https://x.com/filtered',
        score: 20,
        status: 'filtered',
      }),
    ]);
    const rows = await list();
    expect(rows.map((r) => r.listingUrl)).toEqual(['https://x.com/high', 'https://x.com/low']);
    expect(rows[0]).toMatchObject({
      score: 92,
      reasons: ['Node.js', 'TLV'],
      status: 'new',
    });
    expect((await list('?status=filtered')).map((r) => r.listingUrl)).toEqual([
      'https://x.com/filtered',
    ]);
  });

  it('GET rejects an unknown status', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `${BASE}?status=nope`,
    });
    expect(res.statusCode).toBe(400);
  });

  it('insertMany skips URLs that already exist and existingUrls finds them', async () => {
    expect(await repo.insertMany([newOpportunity({ listingUrl: 'https://x.com/1' })])).toBe(1);
    expect(
      await repo.insertMany([
        newOpportunity({ listingUrl: 'https://x.com/1' }),
        newOpportunity({ listingUrl: 'https://x.com/2' }),
      ]),
    ).toBe(1);
    expect(await repo.existingUrls(['https://x.com/1', 'https://x.com/3'])).toEqual(
      new Set(['https://x.com/1']),
    );
    expect(await repo.existingUrls([])).toEqual(new Set());
  });

  it('POST /:id/promote creates the application and links it; a second promote is 409', async () => {
    await repo.insertMany([
      newOpportunity({
        companyName: 'Monday.com',
        title: 'Engineering Manager',
        isManagement: true,
      }),
    ]);
    const [opp] = await list();
    if (!opp) throw new Error('missing opportunity');

    const res = await t.app.inject({
      method: 'POST',
      url: `${BASE}/${opp.id}/promote`,
    });
    expect(res.statusCode).toBe(201);
    const app = res.json<ApplicationDetailDto>();
    expect(app).toMatchObject({
      roleName: 'Engineering Manager',
      isManagement: true,
      status: 'to_apply',
      source: 'AI scout',
      company: { name: 'Monday.com' },
    });

    const fetched = await t.app.inject({
      method: 'GET',
      url: `/api/v1/applications/${app.id}`,
    });
    expect(fetched.statusCode).toBe(200);
    expect(await list()).toEqual([]);
    expect((await list('?status=promoted'))[0]).toMatchObject({
      applicationId: app.id,
    });

    const again = await t.app.inject({
      method: 'POST',
      url: `${BASE}/${opp.id}/promote`,
    });
    expect(again.statusCode).toBe(409);
  });

  it('POST /:id/dismiss hides the suggestion', async () => {
    await repo.insertMany([newOpportunity()]);
    const [opp] = await list();
    if (!opp) throw new Error('missing opportunity');
    const res = await t.app.inject({
      method: 'POST',
      url: `${BASE}/${opp.id}/dismiss`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<OpportunityDto>().status).toBe('dismissed');
    expect(await list()).toEqual([]);
  });

  it('unlinks the opportunity when its application is deleted', async () => {
    await repo.insertMany([newOpportunity()]);
    const [opp] = await list();
    if (!opp) throw new Error('missing opportunity');
    const app = (
      await t.app.inject({ method: 'POST', url: `${BASE}/${opp.id}/promote` })
    ).json<ApplicationDetailDto>();
    await t.app.inject({
      method: 'DELETE',
      url: `/api/v1/applications/${app.id}`,
    });
    expect((await repo.findById(opp.id))?.applicationId).toBeNull();
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const unknown = crypto.randomUUID();
    for (const action of ['promote', 'dismiss']) {
      const res = await t.app.inject({
        method: 'POST',
        url: `${BASE}/${unknown}/${action}`,
      });
      expect(res.statusCode).toBe(404);
    }
    const bad = await t.app.inject({
      method: 'POST',
      url: `${BASE}/nope/promote`,
    });
    expect(bad.statusCode).toBe(400);
  });
});
