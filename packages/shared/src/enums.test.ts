import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES, isActiveStatus, STATUS_LABELS } from './enums.js';

describe('application statuses', () => {
  it('starts the pipeline at to_apply and includes terminal outcomes', () => {
    expect(APPLICATION_STATUSES[0]).toBe('to_apply');
    expect(APPLICATION_STATUSES).toEqual(
      expect.arrayContaining(['applied', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted']),
    );
  });

  it('treats closed outcomes as inactive', () => {
    for (const s of ['accepted', 'rejected', 'withdrawn', 'ghosted'] as const) {
      expect(isActiveStatus(s)).toBe(false);
    }
  });

  it('treats in-progress statuses as active', () => {
    for (const s of ['to_apply', 'applied', 'hr_screening', 'offer'] as const) {
      expect(isActiveStatus(s)).toBe(true);
    }
  });

  it('has a human label for every status', () => {
    for (const s of APPLICATION_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
  });
});
