import { type ApplicationCreateInput, ApplicationCreateSchema } from '@job-tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeApplicationsRepository,
  FakeCompaniesRepository,
  FakeInterviewsRepository,
} from '../../../test/fakes.js';
import { NotFoundError } from '../../errors.js';
import { ApplicationsService } from './applications.service.js';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const input = (overrides: Partial<ApplicationCreateInput> = {}) =>
  ApplicationCreateSchema.parse({
    company: { name: 'Acme', size: 'startup' },
    roleName: 'Backend Engineer',
    ...overrides,
  });

describe('ApplicationsService', () => {
  let apps: FakeApplicationsRepository;
  let companies: FakeCompaniesRepository;
  let interviews: FakeInterviewsRepository;
  let service: ApplicationsService;

  beforeEach(() => {
    companies = new FakeCompaniesRepository();
    apps = new FakeApplicationsRepository(companies);
    interviews = new FakeInterviewsRepository();
    service = new ApplicationsService({
      applications: apps,
      companies,
      interviews,
      now: () => NOW,
    });
  });

  describe('create', () => {
    it('creates a new company and records the initial status in history', async () => {
      const created = await service.create(input());
      expect(created.company.name).toBe('Acme');
      expect(created.status).toBe('to_apply');
      expect(created.history).toEqual([
        expect.objectContaining({ fromStatus: null, toStatus: 'to_apply' }),
      ]);
    });

    it('reuses an existing company with the same name (case-insensitive)', async () => {
      const existing = await companies.create({
        name: 'ACME',
        isPublic: false,
      });
      const created = await service.create(input());
      expect(created.company.id).toBe(existing.id);
      expect(companies.rows).toHaveLength(1);
    });

    it('throws NotFoundError for an unknown company id', async () => {
      await expect(
        service.create(input({ company: { id: '00000000-0000-4000-8000-000000000000' } })),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('sets appliedAt to now when created past to_apply without a date', async () => {
      const created = await service.create(input({ status: 'applied' }));
      expect(created.appliedAt).toBe(NOW.toISOString());
    });

    it('keeps appliedAt empty for to_apply', async () => {
      const created = await service.create(input());
      expect(created.appliedAt).toBeNull();
    });

    it('saves contacts', async () => {
      const created = await service.create(
        input({
          contacts: [{ name: 'Dana' }, { name: 'Avi', email: 'avi@acme.com' }],
        }),
      );
      expect(created.contacts.map((c) => c.name)).toEqual(['Dana', 'Avi']);
    });
  });

  describe('changeStatus', () => {
    it('updates the status and appends a history entry', async () => {
      const { id } = await service.create(input({ status: 'applied' }));
      const updated = await service.changeStatus(id, 'hr_screening');
      expect(updated.status).toBe('hr_screening');
      expect(updated.history.at(-1)).toEqual(
        expect.objectContaining({
          fromStatus: 'applied',
          toStatus: 'hr_screening',
        }),
      );
    });

    it('creates the interview for a round stage, at the given time or now', async () => {
      const { id } = await service.create(input({ status: 'applied' }));
      await service.changeStatus(id, 'hr_screening');
      const at = new Date('2026-11-08T12:00:00.000Z');
      const updated = await service.changeStatus(id, 'technical_interview', at);
      expect(interviews.created.map((i) => [i.type, i.scheduledAt])).toEqual([
        ['hr', NOW.toISOString()],
        ['technical', at.toISOString()],
      ]);
      expect(updated.history.at(-1)?.interviewId).toBe(interviews.created[1]?.id);
    });

    it('does not create an interview for non-round statuses', async () => {
      const { id } = await service.create(input({ status: 'applied' }));
      const updated = await service.changeStatus(id, 'offer');
      expect(interviews.created).toEqual([]);
      expect(updated.history.at(-1)?.interviewId).toBeNull();
    });

    it('leaves the stored status alone when an interview is scheduled, but marks it as applied', async () => {
      const { id } = await service.create(input({ status: 'to_apply' }));
      await interviews.create(id, { type: 'phone', scheduledAt: NOW });
      await service.onInterviewScheduled(id);
      const app = await service.get(id);
      expect(app.status).toBe('to_apply');
      expect(app.appliedAt).not.toBeNull();
      expect(app.history).toHaveLength(1);
    });

    it('does not record history when the status is unchanged', async () => {
      const { id } = await service.create(input({ status: 'applied' }));
      const updated = await service.changeStatus(id, 'applied');
      expect(updated.history).toHaveLength(1);
    });

    it('sets appliedAt when moving out of to_apply for the first time', async () => {
      const { id } = await service.create(input());
      const updated = await service.changeStatus(id, 'applied');
      expect(updated.appliedAt).toBe(NOW.toISOString());
    });

    it('does not overwrite an existing appliedAt', async () => {
      const { id } = await service.create(
        input({
          status: 'applied',
          appliedAt: new Date('2026-10-01T00:00:00.000Z'),
        }),
      );
      const updated = await service.changeStatus(id, 'phone_interview');
      expect(updated.appliedAt).toBe('2026-10-01T00:00:00.000Z');
    });

    it('throws NotFoundError for an unknown application', async () => {
      await expect(service.changeStatus('missing', 'applied')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('update', () => {
    it('updates application fields and company fields', async () => {
      const { id } = await service.create(input());
      const updated = await service.update(id, {
        notes: 'Great culture',
        company: { isPublic: true },
      });
      expect(updated.notes).toBe('Great culture');
      expect(updated.company.isPublic).toBe(true);
    });

    it('throws NotFoundError for an unknown application', async () => {
      await expect(service.update('missing', { notes: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes the application', async () => {
      const { id } = await service.create(input());
      await service.remove(id);
      await expect(service.get(id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
