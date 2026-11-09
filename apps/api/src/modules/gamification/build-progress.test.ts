import { describe, expect, it } from 'vitest';
import type {
  ApplicationItem,
  ContactLinkItem,
  HistoryItem,
  InterviewItem,
} from '../../db/mappers.js';
import { buildProgress } from './build-progress.js';

const app = (over: Partial<ApplicationItem> = {}): ApplicationItem => ({
  id: 'a1',
  companyId: 'c1',
  roleName: 'Dev',
  isManagement: false,
  status: 'applied',
  listingUrl: null,
  expectedSalaryIls: null,
  source: null,
  applicationMethod: null,
  referrerName: null,
  referrerChannel: null,
  methodDetails: null,
  notes: null,
  appliedAt: null,
  reachedStatuses: ['applied'],
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
  ...over,
});

const NOW = new Date('2026-11-06T09:00:00Z');
const empty = { applications: [], history: [], interviews: [], contacts: [] };

describe('buildProgress', () => {
  it('is empty for no data', () => {
    expect(buildProgress(empty, NOW)).toMatchObject({
      today: '2026-11-06',
      days: [],
      applicationsCount: 0,
      stageReachedCounts: {},
    });
  });

  it('buckets activity by the Israeli calendar day', () => {
    // 22:30Z on the 5th is already the 6th in Israel (UTC+2 in November).
    const at = '2026-11-05T22:30:00.000Z';
    const p = buildProgress(
      { ...empty, applications: [app({ createdAt: at, appliedAt: at })] },
      NOW,
    );
    expect(p.days).toEqual([
      { date: '2026-11-06', added: 1, applied: 1, statusChanges: 0, interviews: 0, contacts: 0 },
    ]);
    expect(p.appliedCount).toBe(1);
  });

  it('counts stages once per application and ignores the initial history row', () => {
    const history: HistoryItem[] = [
      {
        id: 'h0',
        applicationId: 'a1',
        fromStatus: null,
        toStatus: 'applied',
        changedAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 'h1',
        applicationId: 'a1',
        fromStatus: 'applied',
        toStatus: 'offer',
        changedAt: '2026-11-06T08:00:00.000Z',
      },
    ];
    const p = buildProgress(
      {
        ...empty,
        applications: [app({ reachedStatuses: ['applied', 'offer', 'offer'] })],
        history,
      },
      NOW,
    );
    expect(p.stageReachedCounts).toEqual({ applied: 1, offer: 1 });
    expect(p.days.find((d) => d.date === '2026-11-06')?.statusChanges).toBe(1);
    expect(p.days.find((d) => d.date === '2026-11-05')?.statusChanges).toBe(0);
  });

  it('summarises interviews and contacts', () => {
    const interviews = [
      { id: 'i1', type: 'phone', createdAt: '2026-11-06T07:00:00.000Z' },
      { id: 'i2', type: 'phone', createdAt: '2026-11-06T07:05:00.000Z' },
      { id: 'i3', type: 'technical', createdAt: '2026-11-06T07:10:00.000Z' },
    ] as InterviewItem[];
    const contacts = [{ id: 'c1', createdAt: '2026-11-06T07:00:00.000Z' }] as ContactLinkItem[];
    const p = buildProgress({ ...empty, interviews, contacts }, NOW);
    expect(p).toMatchObject({ interviewsCount: 3, contactsCount: 1 });
    expect([...p.interviewTypesUsed].sort()).toEqual(['phone', 'technical']);
  });
});
