import type {
  ApplicationDetailDto,
  ContactDto,
  InterviewDto,
  OpportunityDto,
  OverviewDto,
  ScoutCriteriaDto,
} from '@job-tracker/shared';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newOpportunity } from '../../test/fakes.js';
import { createTestApp, resetDb, type TestApp } from '../../test/helpers.js';
import { DynamoOpportunitiesRepository } from '../modules/opportunities/opportunities.repository.js';
import { createServices } from '../services.js';
import { createMcpServer } from './server.js';

interface TextResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

describe('MCP server', () => {
  let t: TestApp;
  let client: Client;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await resetDb(t.db);
    const server = createMcpServer(createServices(t.db));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientSide);
  });

  const raw = async (name: string, args: Record<string, unknown> = {}) =>
    (await client.callTool({ name, arguments: args })) as TextResult;

  /** Calls a tool that must succeed and returns its parsed JSON payload. */
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const result = await raw(name, args);
    const text = result.content[0]?.text ?? '';
    if (result.isError) throw new Error(`${name} failed: ${text}`);
    return JSON.parse(text) as T;
  };

  /** Calls a tool that must fail and returns its error message. */
  const callError = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await raw(name, args);
    expect(result.isError).toBe(true);
    return result.content[0]?.text ?? '';
  };

  it('lists every tool with read-only and destructive annotations', async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect([...byName.keys()].sort()).toEqual(
      [
        'list_applications',
        'get_application',
        'create_application',
        'update_application',
        'change_application_status',
        'delete_application',
        'add_contact',
        'update_contact',
        'remove_contact',
        'schedule_interview',
        'update_interview',
        'remove_interview',
        'search_companies',
        'get_overview',
        'list_suggestions',
        'add_suggestion',
        'promote_suggestion',
        'dismiss_suggestion',
        'get_scout_criteria',
        'update_scout_criteria',
      ].sort(),
    );
    for (const name of ['list_applications', 'get_application', 'get_overview']) {
      expect(byName.get(name)?.annotations?.readOnlyHint).toBe(true);
    }
    for (const name of ['delete_application', 'remove_contact', 'remove_interview']) {
      expect(byName.get(name)?.annotations?.destructiveHint).toBe(true);
    }
    for (const tool of tools) expect(tool.description).toBeTruthy();
  });

  it('manages an application, its contacts and interviews end to end', async () => {
    const created = await call<ApplicationDetailDto>('create_application', {
      company: { name: 'OrbitPay', size: 'unicorn' },
      roleName: 'Engineering Manager',
      isManagement: true,
      listingUrl: 'https://jobs.orbitpay.com/42',
      contacts: [{ name: 'Dana', role: 'Recruiter', email: 'dana@orbitpay.com' }],
    });
    expect(created).toMatchObject({
      status: 'to_apply',
      company: { name: 'OrbitPay', size: 'unicorn' },
      contacts: [{ name: 'Dana' }],
    });

    const moved = await call<ApplicationDetailDto>('change_application_status', {
      id: created.id,
      status: 'technical_interview',
    });
    expect(moved.history.map((h) => h.toStatus)).toEqual(['to_apply', 'technical_interview']);
    expect(moved.appliedAt).not.toBeNull();
    // a round stage is recorded as an interview too (dated now)
    expect(moved.interviews).toMatchObject([{ type: 'technical' }]);
    expect(moved.history.at(-1)?.interviewId).toBe(moved.interviews[0]?.id);

    const scheduledAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const interview = await call<InterviewDto>('schedule_interview', {
      applicationId: created.id,
      type: 'technical',
      scheduledAt,
      durationMinutes: 60,
    });
    expect(interview).toMatchObject({ type: 'technical', durationMinutes: 60 });
    const overview = await call<OverviewDto>('get_overview');
    expect(overview.nextInterview).toMatchObject({
      id: interview.id,
      companyName: 'OrbitPay',
    });

    await call<InterviewDto>('update_interview', {
      applicationId: created.id,
      interviewId: interview.id,
      location: 'Zoom',
    });

    const [dana] = created.contacts;
    if (!dana) throw new Error('missing contact');
    const contact = await call<ContactDto>('update_contact', {
      applicationId: created.id,
      contactId: dana.id,
      phone: '+972-50-0000000',
    });
    expect(contact.phone).toBe('+972-50-0000000');
    const avi = await call<ContactDto>('add_contact', {
      applicationId: created.id,
      name: 'Avi',
      role: 'Hiring manager',
    });

    const updated = await call<ApplicationDetailDto>('update_application', {
      id: created.id,
      expectedSalaryIls: 48000,
      notes: 'Referral from Dana',
    });
    expect(updated).toMatchObject({
      expectedSalaryIls: 48000,
      notes: 'Referral from Dana',
    });

    await call('remove_contact', {
      applicationId: created.id,
      contactId: avi.id,
    });
    await call('remove_interview', {
      applicationId: created.id,
      interviewId: interview.id,
    });
    const detail = await call<ApplicationDetailDto>('get_application', {
      id: created.id,
    });
    expect(detail.contacts.map((c) => c.name)).toEqual(['Dana']);
    expect(detail.interviews).toEqual(moved.interviews);

    const rows = await call<Record<string, unknown>[]>('list_applications', {
      q: 'orbit',
    });
    expect(rows).toEqual([
      {
        id: created.id,
        company: 'OrbitPay',
        roleName: 'Engineering Manager',
        status: 'technical_interview',
        nextInterviewAt: null,
        interviewsCount: 1,
        updatedAt: expect.any(String),
      },
    ]);
    expect(await call('list_applications', { active: false })).toEqual([]);
    expect(await call('search_companies', { q: 'orb' })).toEqual([
      expect.objectContaining({ name: 'OrbitPay' }),
    ]);

    await call('delete_application', { id: created.id });
    expect(await callError('get_application', { id: created.id })).toMatch(/not found/i);
  });

  it('creates an application for an existing company by id', async () => {
    const first = await call<ApplicationDetailDto>('create_application', {
      company: { name: 'Wix' },
      roleName: 'Backend Engineer',
    });
    const second = await call<ApplicationDetailDto>('create_application', {
      company: { id: first.company.id },
      roleName: 'Platform Engineer',
    });
    expect(second.company.id).toBe(first.company.id);
  });

  it('adds a suggestion and rejects duplicate listing URLs', async () => {
    const added = await call<OpportunityDto>('add_suggestion', {
      listingUrl: 'https://jobs.example.com/role/1?utm_source=x',
      companyName: 'Nimbus',
      title: 'Staff Engineer',
    });
    expect(added).toMatchObject({
      listingUrl: 'https://jobs.example.com/role/1',
      source: 'Manual',
      status: 'new',
    });
    expect(await call<OpportunityDto[]>('list_suggestions')).toHaveLength(1);
    expect(
      await callError('add_suggestion', {
        listingUrl: 'https://jobs.example.com/role/1',
        companyName: 'Nimbus',
        title: 'Staff Engineer',
      }),
    ).toMatch(/already exists/i);
  });

  it('lists, promotes and dismisses suggestions', async () => {
    const repo = new DynamoOpportunitiesRepository(t.db);
    await repo.insertMany([
      newOpportunity({
        listingUrl: 'https://x.com/a',
        companyName: 'Nimbus',
        score: 90,
      }),
      newOpportunity({ listingUrl: 'https://x.com/b', score: 70 }),
    ]);
    const suggestions = await call<OpportunityDto[]>('list_suggestions');
    expect(suggestions.map((s) => s.score)).toEqual([90, 70]);
    const [best, other] = suggestions;
    if (!best || !other) throw new Error('missing suggestions');

    const app = await call<ApplicationDetailDto>('promote_suggestion', {
      id: best.id,
    });
    expect(app).toMatchObject({
      company: { name: 'Nimbus' },
      source: 'AI scout',
    });
    expect(await callError('promote_suggestion', { id: best.id })).toMatch(/already promoted/i);

    expect(await call<OpportunityDto>('dismiss_suggestion', { id: other.id })).toMatchObject({
      status: 'dismissed',
    });
    expect(await call('list_suggestions')).toEqual([]);
    expect(await call<OpportunityDto[]>('list_suggestions', { status: 'promoted' })).toEqual([
      expect.objectContaining({ id: best.id, applicationId: app.id }),
    ]);
  });

  it('updates scout criteria partially, keeping fields that were not sent', async () => {
    await call('update_scout_criteria', {
      roles: ['Backend Engineer'],
      minScore: 70,
    });
    const next = await call<ScoutCriteriaDto>('update_scout_criteria', {
      track: 'ic',
    });
    expect(next).toMatchObject({
      roles: ['Backend Engineer'],
      minScore: 70,
      track: 'ic',
    });
    expect(await call<ScoutCriteriaDto>('get_scout_criteria')).toMatchObject({
      track: 'ic',
    });
  });

  it('returns actionable errors instead of throwing', async () => {
    const unknown = crypto.randomUUID();
    expect(await callError('get_application', { id: unknown })).toMatch(
      new RegExp(`Application ${unknown} not found`),
    );
    expect(
      await callError('change_application_status', {
        id: unknown,
        status: 'nope',
      }),
    ).toMatch(/status/i);
    expect(
      await callError('create_application', {
        company: { name: 'Acme' },
        roleName: 'Engineer',
        listingUrl: 'not-a-url',
      }),
    ).toMatch(/listingUrl/);
    expect(await callError('update_scout_criteria', { minScore: 500 })).toMatch(/minScore/);

    const a = await call<ApplicationDetailDto>('create_application', {
      company: { name: 'Acme' },
      roleName: 'Engineer',
      contacts: [{ name: 'Dana' }],
    });
    const b = await call<ApplicationDetailDto>('create_application', {
      company: { name: 'Acme' },
      roleName: 'Designer',
    });
    const contactId = a.contacts[0]?.id;
    expect(
      await callError('update_contact', {
        applicationId: b.id,
        contactId,
        name: 'X',
      }),
    ).toMatch(/Contact .* not found/);
    expect(await callError('add_contact', { applicationId: unknown, name: 'X' })).toMatch(
      /Application .* not found/,
    );
  });
});
