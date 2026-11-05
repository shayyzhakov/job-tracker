import type { ApplicationDetailDto, ApplicationDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const BASE = '/api/v1/applications';
const body = {
  company: { name: 'Acme', size: 'unicorn', isPublic: false, location: 'Tel Aviv' },
  roleName: 'Engineering Manager',
  isManagement: true,
  status: 'applied',
  listingUrl: 'https://jobs.acme.com/42',
  expectedSalaryIls: 45000,
  notes: 'Referral from Dana',
  contacts: [
    { name: 'Dana', role: 'Recruiter', email: 'dana@acme.com', phone: '+972-50-0000000' },
    { name: 'Avi', role: 'Hiring manager' },
  ],
};

describe('applications API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const create = async (overrides: Record<string, unknown> = {}) => {
    const res = await t.app.inject({
      method: 'POST',
      url: BASE,
      payload: { ...body, ...overrides },
    });
    expect(res.statusCode).toBe(201);
    return res.json<ApplicationDetailDto>();
  };

  it('POST creates an application with company, contacts and initial history', async () => {
    const created = await create();
    expect(created).toMatchObject({
      roleName: 'Engineering Manager',
      isManagement: true,
      status: 'applied',
      expectedSalaryIls: 45000,
      company: { name: 'Acme', size: 'unicorn', location: 'Tel Aviv' },
    });
    expect(created.appliedAt).not.toBeNull();
    expect(created.contacts.map((c) => c.name)).toEqual(['Dana', 'Avi']);
    expect(created.history).toHaveLength(1);
  });

  it('POST returns 400 for invalid input', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: BASE,
      payload: { ...body, roleName: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST reuses an existing company by name', async () => {
    const a = await create();
    const b = await create({ company: { name: 'acme' }, roleName: 'Staff Engineer' });
    expect(b.company.id).toBe(a.company.id);
  });

  it('GET /:id returns 404 for an unknown id and 400 for a malformed one', async () => {
    const missing = await t.app.inject({
      method: 'GET',
      url: `${BASE}/00000000-0000-4000-8000-000000000000`,
    });
    expect(missing.statusCode).toBe(404);
    const malformed = await t.app.inject({ method: 'GET', url: `${BASE}/nope` });
    expect(malformed.statusCode).toBe(400);
  });

  it('GET lists applications filtered by active, status and search', async () => {
    await create();
    await create({ company: { name: 'Globex' }, roleName: 'Backend Dev', status: 'rejected' });
    const list = async (qs: string) =>
      (await t.app.inject({ method: 'GET', url: `${BASE}?${qs}` })).json<ApplicationDto[]>();

    expect(await list('')).toHaveLength(2);
    expect((await list('active=true')).map((a) => a.company.name)).toEqual(['Acme']);
    expect((await list('status=rejected')).map((a) => a.company.name)).toEqual(['Globex']);
    expect((await list('q=backend')).map((a) => a.roleName)).toEqual(['Backend Dev']);
    expect((await list('q=glob')).map((a) => a.roleName)).toEqual(['Backend Dev']);
  });

  it('PATCH /:id/status changes status and records history', async () => {
    const { id } = await create();
    const res = await t.app.inject({
      method: 'PATCH',
      url: `${BASE}/${id}/status`,
      payload: { status: 'phone_interview' },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json<ApplicationDetailDto>();
    expect(updated.status).toBe('phone_interview');
    expect(updated.history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, 'applied'],
      ['applied', 'phone_interview'],
    ]);
  });

  it('PATCH /:id/status rejects an unknown status', async () => {
    const { id } = await create();
    const res = await t.app.inject({
      method: 'PATCH',
      url: `${BASE}/${id}/status`,
      payload: { status: 'hired?' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /:id updates fields, clears nullable ones and updates the company', async () => {
    const { id } = await create();
    const res = await t.app.inject({
      method: 'PATCH',
      url: `${BASE}/${id}`,
      payload: { notes: 'Second round next week', listingUrl: '', company: { isPublic: true } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      notes: 'Second round next week',
      listingUrl: null,
      isManagement: true,
      company: { isPublic: true },
    });
  });

  it('DELETE /:id removes the application', async () => {
    const { id } = await create();
    expect((await t.app.inject({ method: 'DELETE', url: `${BASE}/${id}` })).statusCode).toBe(204);
    expect((await t.app.inject({ method: 'GET', url: `${BASE}/${id}` })).statusCode).toBe(404);
  });

  it('GET /api/v1/companies searches companies', async () => {
    await create();
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/companies?q=ac' });
    expect(res.json()).toEqual([expect.objectContaining({ name: 'Acme' })]);
  });
});
