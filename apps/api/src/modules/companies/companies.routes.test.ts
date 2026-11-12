import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  ApplicationDetailDto,
  CompanyDetailDto,
  CompanyDto,
  CompanyWithCountsDto,
} from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

describe('companies API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const post = (payload: Record<string, unknown>) =>
    t.app.inject({ method: 'POST', url: '/api/v1/companies', payload });
  const list = async () =>
    (await t.app.inject({ method: 'GET', url: '/api/v1/companies/with-counts' })).json<
      CompanyWithCountsDto[]
    >();

  it('creates a company without any application and lists it as 0 / 0', async () => {
    const res = await post({ name: 'Wix', size: 'corporate', isPublic: true });
    expect(res.statusCode).toBe(201);
    expect(res.json<CompanyDto>()).toMatchObject({
      name: 'Wix',
      size: 'corporate',
      isPublic: true,
    });
    expect(await list()).toEqual([
      expect.objectContaining({ name: 'Wix', openApplications: 0, totalApplications: 0 }),
    ]);
  });

  it('starts new companies at moderate priority and accepts an explicit one', async () => {
    expect((await post({ name: 'Wix' })).json<CompanyDto>().priority).toBe('moderate');
    const top = (await post({ name: 'Monday', priority: 'top' })).json<CompanyDto>();
    expect(top.priority).toBe('top');
    expect((await post({ name: 'Bad', priority: 'urgent' })).statusCode).toBe(400);

    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/companies/${top.id}`,
      payload: { priority: 'blacklist' },
    });
    expect(patched.json<CompanyDto>()).toMatchObject({ name: 'Monday', priority: 'blacklist' });
  });

  it('reads a company stored before priorities existed as moderate', async () => {
    const { id } = (await post({ name: 'Legacy' })).json<CompanyDto>();
    await t.db.doc.send(
      new UpdateCommand({
        TableName: t.db.table,
        Key: { PK: `COMPANY#${id}`, SK: 'META' },
        UpdateExpression: 'REMOVE priority',
      }),
    );
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/companies/${id}` });
    expect(res.json<CompanyDto>().priority).toBe('moderate');
  });

  it('rejects a duplicate name, ignoring case', async () => {
    await post({ name: 'Wix' });
    expect((await post({ name: 'wix' })).statusCode).toBe(409);
  });

  it('counts active and total applications per company', async () => {
    await createApplication(t.app, { status: 'applied' });
    await createApplication(t.app, { status: 'offer' });
    await createApplication(t.app, { status: 'rejected' });
    await createApplication(t.app, { company: { name: 'Other' }, status: 'applied' });

    const rows = await list();
    expect(rows.find((c) => c.name === 'Acme')).toMatchObject({
      openApplications: 2,
      totalApplications: 3,
    });
    expect(rows.find((c) => c.name === 'Other')).toMatchObject({
      openApplications: 1,
      totalApplications: 1,
    });
  });

  it('filters the list by name', async () => {
    await post({ name: 'Wix' });
    await post({ name: 'Monday' });
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/companies/with-counts?q=mon' });
    expect(res.json<CompanyWithCountsDto[]>().map((c) => c.name)).toEqual(['Monday']);
  });

  it('shows an edit on every application of the company', async () => {
    const a = await createApplication(t.app);
    const b = await createApplication(t.app, { roleName: 'Lead' });
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/companies/${a.company.id}`,
      payload: { size: 'scale_up', location: 'Tel Aviv' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<CompanyDetailDto>()).toMatchObject({ size: 'scale_up', totalApplications: 2 });
    for (const app of [a, b]) {
      const detail = await t.app.inject({ method: 'GET', url: `/api/v1/applications/${app.id}` });
      expect(detail.json<ApplicationDetailDto>().company).toMatchObject({
        size: 'scale_up',
        location: 'Tel Aviv',
      });
    }
  });

  it('clears optional fields with null and keeps the others', async () => {
    const { id } = (
      await post({ name: 'Wix', size: 'startup', location: 'TLV' })
    ).json<CompanyDto>();
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/companies/${id}`,
      payload: { size: null, location: null },
    });
    expect(res.json<CompanyDto>()).toMatchObject({ name: 'Wix', size: null, location: null });
  });

  it('renames a company and frees the old name', async () => {
    const { id } = (await post({ name: 'Wix' })).json<CompanyDto>();
    const patch = (name: string) =>
      t.app.inject({ method: 'PATCH', url: `/api/v1/companies/${id}`, payload: { name } });
    expect((await patch('Wix Ltd')).statusCode).toBe(200);
    expect((await post({ name: 'Wix' })).statusCode).toBe(201);
  });

  it('rejects renaming into another company’s name', async () => {
    await post({ name: 'Wix' });
    const { id } = (await post({ name: 'Monday' })).json<CompanyDto>();
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/companies/${id}`,
      payload: { name: 'WIX' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns the company with its applications', async () => {
    const a = await createApplication(t.app, { status: 'rejected' });
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/companies/${a.company.id}` });
    expect(res.json<CompanyDetailDto>()).toMatchObject({
      name: 'Acme',
      openApplications: 0,
      totalApplications: 1,
      applications: [{ id: a.id, roleName: 'Engineer', status: 'rejected' }],
    });
  });

  it('returns 404 for an unknown company', async () => {
    for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
      const res = await t.app.inject({
        method,
        url: `/api/v1/companies/${MISSING}`,
        ...(method === 'PATCH' && { payload: { name: 'x' } }),
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('refuses to delete a company that has any application, even a closed one', async () => {
    const a = await createApplication(t.app, { status: 'rejected' });
    const res = await t.app.inject({ method: 'DELETE', url: `/api/v1/companies/${a.company.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/1 application/);
    expect(await list()).toHaveLength(1);
  });

  it('deletes a company without applications and frees its name', async () => {
    const { id } = (await post({ name: 'Wix' })).json<CompanyDto>();
    expect(
      (await t.app.inject({ method: 'DELETE', url: `/api/v1/companies/${id}` })).statusCode,
    ).toBe(204);
    expect(await list()).toEqual([]);
    expect((await post({ name: 'Wix' })).statusCode).toBe(201);
  });

  it('allows deleting the company once its last application is deleted', async () => {
    const a = await createApplication(t.app);
    await t.app.inject({ method: 'DELETE', url: `/api/v1/applications/${a.id}` });
    const res = await t.app.inject({ method: 'DELETE', url: `/api/v1/companies/${a.company.id}` });
    expect(res.statusCode).toBe(204);
  });

  it('keeps the plain name search used by the application form', async () => {
    await post({ name: 'Wix' });
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/companies?q=wi' });
    expect(res.json<CompanyDto[]>()).toEqual([expect.objectContaining({ name: 'Wix' })]);
  });
});
