import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  displayedStatus,
  INITIAL_STATUSES,
  type InterviewType,
  isOpenStatus,
  STATUS_LABELS,
  statusGroup,
} from './enums.js';

describe('application statuses', () => {
  it('starts the pipeline at to_apply and includes terminal outcomes', () => {
    expect(APPLICATION_STATUSES[0]).toBe('to_apply');
    expect(APPLICATION_STATUSES).toEqual(
      expect.arrayContaining(['applied', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted']),
    );
  });

  it('treats closed outcomes as not open', () => {
    for (const s of ['accepted', 'rejected', 'withdrawn', 'ghosted'] as const) {
      expect(isOpenStatus(s)).toBe(false);
    }
  });

  it('treats initial and active statuses as open', () => {
    for (const s of ['to_apply', 'applied', 'hr_screening', 'offer'] as const) {
      expect(isOpenStatus(s)).toBe(true);
    }
  });

  it('puts every status in exactly one group', () => {
    expect(statusGroup('to_apply')).toBe('initial');
    expect(statusGroup('applied')).toBe('initial');
    for (const s of ['hr_screening', 'onsite_interview', 'final_interview', 'offer'] as const) {
      expect(statusGroup(s)).toBe('active');
    }
    for (const s of ['accepted', 'rejected', 'withdrawn', 'ghosted'] as const) {
      expect(statusGroup(s)).toBe('closed');
    }
    const counted = [...INITIAL_STATUSES, ...ACTIVE_STATUSES, ...CLOSED_STATUSES];
    expect([...counted].sort()).toEqual([...APPLICATION_STATUSES].sort());
  });

  it('has a human label for every status', () => {
    for (const s of APPLICATION_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
  });
});

describe('displayedStatus', () => {
  const base = { statusChangedAt: '2026-01-01T00:00:00.000Z', next: null, lastPast: null };
  const at = (type: InterviewType, when: string) => ({ type, at: when });

  it('shows the upcoming interview round instead of the last passed one', () => {
    expect(
      displayedStatus({
        ...base,
        status: 'phone_interview',
        next: at('technical', '2026-02-01T00:00:00.000Z'),
      }),
    ).toBe('technical_interview');
  });

  it('can go back to an earlier stage', () => {
    expect(
      displayedStatus({
        ...base,
        status: 'technical_interview',
        next: at('phone', '2026-02-01T00:00:00.000Z'),
      }),
    ).toBe('phone_interview');
  });

  it('shows the last real step when nothing is upcoming', () => {
    expect(displayedStatus({ ...base, status: 'phone_interview' })).toBe('phone_interview');
    expect(
      displayedStatus({
        ...base,
        status: 'applied',
        lastPast: at('hr', '2026-01-05T00:00:00.000Z'),
      }),
    ).toBe('hr_screening');
  });

  it('prefers a later manual status change over an older interview', () => {
    expect(
      displayedStatus({
        ...base,
        status: 'technical_interview',
        lastPast: at('hr', '2025-12-01T00:00:00.000Z'),
      }),
    ).toBe('technical_interview');
  });

  it('ignores interviews without a stage and never touches offer or closed', () => {
    const next = at('home_assignment_review', '2026-02-01T00:00:00.000Z');
    expect(displayedStatus({ ...base, status: 'phone_interview', next })).toBe('phone_interview');
    const phone = at('phone', '2026-02-01T00:00:00.000Z');
    expect(displayedStatus({ ...base, status: 'offer', next: phone })).toBe('offer');
    expect(displayedStatus({ ...base, status: 'rejected', next: phone })).toBe('rejected');
  });
});
