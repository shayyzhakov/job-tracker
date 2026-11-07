import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeApplicationsRepository,
  FakeCompaniesRepository,
  FakeInterviewsRepository,
  FakeOpportunitiesRepository,
  newOpportunity,
} from '../../../test/fakes.js';
import { ConflictError, NotFoundError } from '../../errors.js';
import { ApplicationsService } from '../applications/applications.service.js';
import { OpportunitiesService } from './opportunities.service.js';

describe('OpportunitiesService', () => {
  let opportunities: FakeOpportunitiesRepository;
  let companies: FakeCompaniesRepository;
  let apps: FakeApplicationsRepository;
  let service: OpportunitiesService;

  beforeEach(() => {
    opportunities = new FakeOpportunitiesRepository();
    companies = new FakeCompaniesRepository();
    apps = new FakeApplicationsRepository(companies);
    const applications = new ApplicationsService({
      applications: apps,
      companies,
      interviews: new FakeInterviewsRepository(),
    });
    service = new OpportunitiesService({ opportunities, applications });
  });

  const seed = async (overrides: Parameters<typeof newOpportunity>[0] = {}) => {
    await opportunities.insertMany([newOpportunity(overrides)]);
    const row = opportunities.rows.at(-1);
    if (!row) throw new Error('seed failed');
    return row;
  };

  describe('promote', () => {
    it('creates a to_apply application from the listing and links it', async () => {
      const opp = await seed({
        companyName: 'Wix',
        title: 'Senior Backend Engineer',
        listingUrl: 'https://careers.wix.com/1',
        isManagement: false,
        companySize: 'corporate',
        summary: 'Node.js platform team',
      });

      const created = await service.promote(opp.id);

      expect(created).toMatchObject({
        roleName: 'Senior Backend Engineer',
        status: 'to_apply',
        isManagement: false,
        listingUrl: 'https://careers.wix.com/1',
        source: 'AI scout',
        notes: 'Node.js platform team',
        company: { name: 'Wix', size: 'corporate' },
      });
      expect(await opportunities.findById(opp.id)).toMatchObject({
        status: 'promoted',
        applicationId: created.id,
      });
    });

    it('reuses an existing company with the same name', async () => {
      const existing = await companies.create({ name: 'wix', isPublic: true });
      const opp = await seed({ companyName: 'Wix' });
      const created = await service.promote(opp.id);
      expect(created.company.id).toBe(existing.id);
    });

    it('refuses to promote twice', async () => {
      const opp = await seed();
      await service.promote(opp.id);
      await expect(service.promote(opp.id)).rejects.toBeInstanceOf(ConflictError);
      expect(apps.rows).toHaveLength(1);
    });

    it('returns the suggestion to new when creating the application fails', async () => {
      const opp = await seed();
      apps.insert = async () => {
        throw new Error('db down');
      };
      await expect(service.promote(opp.id)).rejects.toThrow('db down');
      expect((await opportunities.findById(opp.id))?.status).toBe('new');
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(service.promote(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('dismiss', () => {
    it('marks a new suggestion as dismissed', async () => {
      const opp = await seed();
      expect(await service.dismiss(opp.id)).toMatchObject({
        id: opp.id,
        status: 'dismissed',
      });
    });

    it('refuses to dismiss a promoted suggestion', async () => {
      const opp = await seed();
      await service.promote(opp.id);
      await expect(service.dismiss(opp.id)).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(service.dismiss(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it('lists by status', async () => {
    await seed({ listingUrl: 'https://x.com/1', status: 'new' });
    await seed({ listingUrl: 'https://x.com/2', status: 'filtered' });
    expect((await service.list({ status: 'new' })).map((o) => o.listingUrl)).toEqual([
      'https://x.com/1',
    ]);
  });
});
