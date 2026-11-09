import type { ApplicationDetailDto, ContactDetailDto, ContactDto } from '@job-tracker/shared';
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
    expect(contact).toMatchObject({ name: 'Dana', applicationCount: 1 });

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

  describe('shared contacts', () => {
    const detail = async (id: string) =>
      (
        await t.app.inject({ method: 'GET', url: `/api/v1/applications/${id}` })
      ).json<ApplicationDetailDto>();

    it('reuses a contact with the same email instead of duplicating it', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana', email: 'Dana@Agency.com' }],
      });
      const b = await createApplication(t.app, {
        company: { name: 'Globex' },
        contacts: [{ name: 'Dana L.', email: 'dana@agency.com' }],
      });
      expect(b.contacts[0]?.id).toBe(a.contacts[0]?.id);
      expect(b.contacts[0]?.name).toBe('Dana');
      expect(b.contacts[0]?.applicationCount).toBe(2);
      const all = (await t.app.inject({ method: 'GET', url: '/api/v1/contacts' })).json<
        ContactDto[]
      >();
      expect(all).toHaveLength(1);
    });

    it('matches on the phone number in any format, but never on the name alone', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana', phone: '052-111-2222' }],
      });
      const b = await createApplication(t.app, { company: { name: 'Globex' } });
      const same = await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: { name: 'D', phone: '+972 52 111 2222' },
      });
      expect(same.json<ContactDto>().id).toBe(a.contacts[0]?.id);
      const c = await createApplication(t.app, {
        company: { name: 'Initech' },
      });
      const other = await t.app.inject({
        method: 'POST',
        url: url(c.id),
        payload: { name: 'Dana' },
      });
      expect(other.json<ContactDto>().id).not.toBe(a.contacts[0]?.id);
    });

    it('matches on the LinkedIn profile too', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana', linkedinUrl: 'https://www.linkedin.com/in/dana/' }],
      });
      const b = await createApplication(t.app, { company: { name: 'Globex' } });
      const res = await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: {
          name: 'Dana',
          linkedinUrl: 'http://linkedin.com/in/dana?utm=x',
        },
      });
      expect(res.json<ContactDto>().id).toBe(a.contacts[0]?.id);
    });

    it('attaches an existing contact by id, and an edit shows on every application', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana' }],
      });
      const b = await createApplication(t.app, { company: { name: 'Globex' } });
      const contactId = a.contacts[0]?.id ?? '';
      const res = await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: { contactId },
      });
      expect(res.statusCode).toBe(201);
      await t.app.inject({
        method: 'PATCH',
        url: url(b.id, contactId),
        payload: { phone: '052' },
      });
      expect((await detail(a.id)).contacts[0]).toMatchObject({
        phone: '052',
        applicationCount: 2,
      });
      // attaching twice is a no-op
      await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: { contactId },
      });
      expect((await detail(b.id)).contacts).toHaveLength(1);
    });

    it('lists the applications of a contact', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana' }],
      });
      const b = await createApplication(t.app, { company: { name: 'Globex' } });
      const contactId = a.contacts[0]?.id ?? '';
      await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: { contactId },
      });
      const res = await t.app.inject({
        method: 'GET',
        url: `/api/v1/contacts/${contactId}`,
      });
      const body = res.json<ContactDetailDto>();
      expect(body.applications.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
      expect(body.applications.map((x) => x.companyName).sort()).toEqual(['Acme', 'Globex'].sort());
      expect(
        (
          await t.app.inject({
            method: 'GET',
            url: `/api/v1/contacts/${MISSING}`,
          })
        ).statusCode,
      ).toBe(404);
    });

    it('removing detaches; the last removal deletes the contact', async () => {
      const a = await createApplication(t.app, {
        contacts: [{ name: 'Dana' }],
      });
      const b = await createApplication(t.app, { company: { name: 'Globex' } });
      const contactId = a.contacts[0]?.id ?? '';
      await t.app.inject({
        method: 'POST',
        url: url(b.id),
        payload: { contactId },
      });
      await t.app.inject({ method: 'DELETE', url: url(a.id, contactId) });
      expect((await detail(b.id)).contacts[0]).toMatchObject({
        name: 'Dana',
        applicationCount: 1,
      });
      await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/applications/${b.id}`,
      });
      const all = (await t.app.inject({ method: 'GET', url: '/api/v1/contacts' })).json<
        ContactDto[]
      >();
      expect(all).toEqual([]);
    });

    it('404s when attaching an unknown contact', async () => {
      const a = await createApplication(t.app);
      const res = await t.app.inject({
        method: 'POST',
        url: url(a.id),
        payload: { contactId: MISSING },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
