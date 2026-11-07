import { APPLICATION_STATUSES } from '@job-tracker/shared';
import { describe, expect, it } from 'vitest';
import { GROUPS, groupOf } from './groups';

describe('pipeline groups', () => {
  it('place every application status in exactly one column (guards new statuses)', () => {
    for (const status of APPLICATION_STATUSES) {
      const holders = GROUPS.filter((g) => g.statuses.includes(status));
      expect(holders, `status "${status}" must be in exactly one group`).toHaveLength(1);
      expect(groupOf(status)).toBe(holders[0]?.id);
    }
  });

  it('only list real statuses', () => {
    for (const g of GROUPS) {
      for (const s of g.statuses) expect(APPLICATION_STATUSES).toContain(s);
    }
  });

  it('drop targets belong to their own group', () => {
    for (const g of GROUPS) {
      if (g.dropStatus) expect(g.statuses).toContain(g.dropStatus);
    }
  });
});
