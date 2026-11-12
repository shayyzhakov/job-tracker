import { describe, expect, it } from 'vitest';
import { adjustScore, PriorityIndex } from './company-priority.js';

describe('PriorityIndex', () => {
  const index = new PriorityIndex([
    { name: 'Wix', priority: 'top' },
    { name: 'Evil Corp', priority: 'blacklist' },
    { name: 'Meh', priority: 'moderate' },
  ]);

  it('matches names ignoring case and surrounding spaces; unknown companies are moderate', () => {
    expect(index.get('  WIX ')).toBe('top');
    expect(index.get('Nobody')).toBe('moderate');
  });

  it('lists only the non-moderate companies', () => {
    expect(index.prioritized().map((c) => c.priority)).toEqual(['top', 'blacklist']);
  });
});

describe('adjustScore', () => {
  it('leaves moderate scores alone and clamps to 0-100', () => {
    expect(adjustScore(70, 'moderate')).toEqual({ score: 70, note: null });
    expect(adjustScore(95, 'top').score).toBe(100);
    expect(adjustScore(3, 'low').score).toBe(0);
  });
});
