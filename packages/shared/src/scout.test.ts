import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCOUT_CRITERIA,
  normalizeListingUrl,
  OpportunityListQuerySchema,
  ScoutCriteriaSchema,
} from './scout.js';

describe('ScoutCriteriaSchema', () => {
  it('fills defaults so an empty object is a usable configuration', () => {
    expect(ScoutCriteriaSchema.parse({})).toEqual(DEFAULT_SCOUT_CRITERIA);
    expect(DEFAULT_SCOUT_CRITERIA).toMatchObject({
      roles: [],
      seniorities: [],
      track: 'either',
      companySizes: [],
      minScore: 60,
    });
  });

  it('trims list entries and drops blanks and case-insensitive duplicates', () => {
    const parsed = ScoutCriteriaSchema.parse({
      roles: ['  Backend Engineer ', '', 'backend engineer', 'Platform Engineer'],
      locations: ['Tel Aviv', 'tel aviv '],
    });
    expect(parsed.roles).toEqual(['Backend Engineer', 'Platform Engineer']);
    expect(parsed.locations).toEqual(['Tel Aviv']);
  });

  it('rejects unknown seniority, track and company size values', () => {
    expect(ScoutCriteriaSchema.safeParse({ seniorities: ['guru'] }).success).toBe(false);
    expect(ScoutCriteriaSchema.safeParse({ track: 'both' }).success).toBe(false);
    expect(ScoutCriteriaSchema.safeParse({ companySizes: ['huge'] }).success).toBe(false);
  });

  it('keeps minScore an integer between 0 and 100', () => {
    expect(ScoutCriteriaSchema.safeParse({ minScore: 101 }).success).toBe(false);
    expect(ScoutCriteriaSchema.safeParse({ minScore: -1 }).success).toBe(false);
    expect(ScoutCriteriaSchema.safeParse({ minScore: 50.5 }).success).toBe(false);
    expect(ScoutCriteriaSchema.parse({ minScore: 75 }).minScore).toBe(75);
  });
});

describe('OpportunityListQuerySchema', () => {
  it('defaults to new suggestions', () => {
    expect(OpportunityListQuerySchema.parse({})).toEqual({ status: 'new' });
  });

  it('rejects unknown statuses', () => {
    expect(OpportunityListQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describe('normalizeListingUrl', () => {
  it('lowercases the host and drops the hash and trailing slash', () => {
    expect(normalizeListingUrl('https://Jobs.Example.COM/Careers/123/#apply')).toBe(
      'https://jobs.example.com/Careers/123',
    );
  });

  it('strips tracking parameters but keeps meaningful ones, sorted', () => {
    expect(
      normalizeListingUrl(
        'https://boards.example.com/job?utm_source=x&gh_jid=42&utm_medium=y&ref=feed&b=2',
      ),
    ).toBe('https://boards.example.com/job?b=2&gh_jid=42');
  });

  it('treats equivalent URLs as the same listing', () => {
    expect(normalizeListingUrl('https://x.com/jobs/1/?utm_campaign=a')).toBe(
      normalizeListingUrl('https://X.com/jobs/1'),
    );
  });

  it('keeps the root path', () => {
    expect(normalizeListingUrl('https://x.com/')).toBe('https://x.com/');
  });

  it('throws on an invalid URL', () => {
    expect(() => normalizeListingUrl('not a url')).toThrow();
  });
});
