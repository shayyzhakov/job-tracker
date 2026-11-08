import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  INITIAL_STATUSES,
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
