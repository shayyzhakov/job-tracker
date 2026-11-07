import { DEFAULT_SCOUT_CRITERIA, type ScoutCriteria } from '@job-tracker/shared';
import { describe, expect, it } from 'vitest';
import type { RawListing } from '../types.js';
import { KeywordScorer } from './keyword-scorer.js';

const listing = (overrides: Partial<RawListing> = {}): RawListing => ({
  url: 'https://x.com/1',
  title: 'Senior Backend Engineer',
  companyName: 'Acme',
  location: 'Tel Aviv, Israel',
  description: 'We build APIs.',
  ...overrides,
});
const criteria = (overrides: Partial<ScoutCriteria> = {}): ScoutCriteria => ({
  ...DEFAULT_SCOUT_CRITERIA,
  roles: ['Backend Engineer'],
  seniorities: ['senior'],
  locations: ['Tel Aviv'],
  ...overrides,
});

describe('KeywordScorer', () => {
  const scorer = new KeywordScorer();

  it('scores a listing matching role, seniority and location highly', async () => {
    const result = await scorer.score(listing(), criteria());
    expect(result.score).toBe(100);
    expect(result.seniority).toBe('senior');
    expect(result.isManagement).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringMatching(/backend engineer/i)]),
    );
  });

  it('scores an unrelated role low', async () => {
    const result = await scorer.score(
      listing({ title: 'Junior Sales Representative', location: 'Haifa' }),
      criteria(),
    );
    expect(result.score).toBeLessThan(30);
  });

  it('detects management roles', async () => {
    const result = await scorer.score(listing({ title: 'Engineering Manager' }), criteria());
    expect(result.isManagement).toBe(true);
    expect(result.seniority).toBe('manager');
  });

  it('gives a neutral score when no criteria are set', async () => {
    const result = await scorer.score(listing(), DEFAULT_SCOUT_CRITERIA);
    expect(result.score).toBe(50);
  });
});
