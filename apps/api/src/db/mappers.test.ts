import { describe, expect, it } from 'vitest';
import {
  type ApplicationItem,
  type CompanyItem,
  type InterviewTiming,
  NO_TIMING,
  toApplicationDto,
} from './mappers.js';

const company = {
  id: 'c1',
  name: 'Uno',
  size: null,
  isPublic: false,
  website: null,
  location: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
} satisfies CompanyItem;

const app = (reachedStatuses: ApplicationItem['reachedStatuses']) =>
  ({
    id: 'a1',
    companyId: 'c1',
    roleName: 'Engineer',
    isManagement: false,
    status: 'applied',
    listingUrl: null,
    expectedSalaryIls: null,
    source: null,
    notes: null,
    appliedAt: '2026-11-03T00:00:00.000Z',
    reachedStatuses,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  }) as ApplicationItem;

describe('toApplicationDto interviewsCount', () => {
  it('ignores round statuses left in old history; only held rounds count', () => {
    const upcoming: InterviewTiming = {
      ...NO_TIMING,
      next: { type: 'coffee', at: '2026-11-10T07:30:00.000Z' },
      nextStaged: { type: 'coffee', at: '2026-11-10T07:30:00.000Z' },
    };
    expect(toApplicationDto(app(['hr_screening']), company, upcoming).interviewsCount).toBe(0);
  });

  it('counts every held interview with a stage, so two phone calls are two', () => {
    const held: InterviewTiming = {
      ...NO_TIMING,
      hasPast: true,
      pastStages: new Set(['phone_interview']),
      heldStaged: 2,
    };
    expect(toApplicationDto(app([]), company, held).interviewsCount).toBe(2);
  });
});
