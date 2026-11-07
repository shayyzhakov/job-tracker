import type { ApplicationDetailDto, ContactDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

describe('contacts API', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => resetDb(t.db));

  const url = (appId: string, contactId?: string) =>
    `/api/v1/applications/${appId}/contacts${contactId ? `/${contactId}` : ''}`;

  it('adds, updates and deletes a contact', async () => {
    const { id } = await createApplication(t.app);

    const added = await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { name: 'Dana', role: 'Recruiter', email: 'dana@acme.com' },
    });
    expect(added.statusCode).toBe(201);
    const contact = added.json<ContactDto>();
    expect(contact).toMatchObject({ name: 'Dana', applicationId: id });

    const patched = await t.app.inject({
      method: 'PATCH',
      url: url(id, contact.id),
      payload: { phone: '+972-52-1111111', linkedinUrl: 'https://www.linkedin.com/in/dana' },
    });
    expect(patched.json()).toMatchObject({
      name: 'Dana',
      phone: '+972-52-1111111',
      linkedinUrl: 'https://www.linkedin.com/in/dana',
    });

    const del = await t.app.inject({
      method: 'DELETE',
      url: url(id, contact.id),
    });
    expect(del.statusCode).toBe(204);
    const detail = (
      await t.app.inject({ method: 'GET', url: `/api/v1/applications/${id}` })
    ).json<ApplicationDetailDto>();
    expect(detail.contacts).toEqual([]);
  });

  it('returns 404 when the application does not exist', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: url(MISSING),
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when the contact belongs to another application', async () => {
    const a = await createApplication(t.app, { contacts: [{ name: 'Dana' }] });
    const b = await createApplication(t.app, { company: { name: 'Globex' } });
    const contactId = a.contacts[0]?.id ?? '';
    const res = await t.app.inject({
      method: 'PATCH',
      url: url(b.id, contactId),
      payload: { name: 'Hijack' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('validates the email', async () => {
    const { id } = await createApplication(t.app);
    const res = await t.app.inject({
      method: 'POST',
      url: url(id),
      payload: { name: 'Dana', email: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });
});
