import {
  DEFAULT_SCOUT_CRITERIA,
  type ScoutCriteria,
  type ScoutCriteriaDto,
} from '@job-tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { runScout, type ScoutDeps } from './run-scout.js';
import type { ListingScore, ListingScorer, ListingSource, RawListing } from './types.js';

const listing = (overrides: Partial<RawListing> = {}): RawListing => ({
  url: 'https://jobs.example.com/1',
  title: 'Senior Backend Engineer',
  companyName: 'Acme',
  location: 'Tel Aviv',
  description: 'Node.js and Postgres.',
  postedAt: '2026-11-04T08:00:00.000Z',
  ...overrides,
});

const source = (name: string, listings: RawListing[]): ListingSource => ({
  name,
  fetchListings: async () => listings,
});

const fixedScorer = (overrides: Partial<ListingScore> = {}) => {
  const score = vi.fn<ListingScorer['score']>(async () => ({
    score: 80,
    summary: 'Strong match',
    reasons: ['Backend role'],
    isManagement: false,
    seniority: 'senior',
    companySize: 'startup',
    ...overrides,
  }));
  return { score } satisfies ListingScorer;
};

function setup(
  opts: {
    sources?: ListingSource[];
    scorer?: ListingScorer;
    criteria?: Partial<ScoutCriteria>;
    existing?: string[];
    unsaved?: boolean;
  } = {},
) {
  const inserted: Parameters<ScoutDeps['opportunities']['insertMany']>[0] = [];
  const criteria: ScoutCriteriaDto = {
    ...DEFAULT_SCOUT_CRITERIA,
    ...opts.criteria,
    updatedAt: opts.unsaved ? null : '2026-11-01T00:00:00.000Z',
  };
  const deps: ScoutDeps = {
    sources: opts.sources ?? [source('fixture', [listing()])],
    scorer: opts.scorer ?? fixedScorer(),
    criteria: { get: async () => criteria },
    opportunities: {
      existingUrls: async (urls) => new Set((opts.existing ?? []).filter((u) => urls.includes(u))),
      insertMany: async (rows) => {
        inserted.push(...rows);
        return rows.length;
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  return { deps, inserted };
}

describe('runScout', () => {
  it('scores new listings and stores them as suggestions', async () => {
    const { deps, inserted } = setup();
    const stats = await runScout(deps);
    expect(stats).toMatchObject({ fetched: 1, scored: 1, suggested: 1, filtered: 0, failed: 0 });
    expect(inserted).toEqual([
      {
        listingUrl: 'https://jobs.example.com/1',
        source: 'fixture',
        companyName: 'Acme',
        title: 'Senior Backend Engineer',
        location: 'Tel Aviv',
        description: 'Node.js and Postgres.',
        postedAt: new Date('2026-11-04T08:00:00.000Z'),
        score: 80,
        summary: 'Strong match',
        reasons: ['Backend role'],
        isManagement: false,
        companySize: 'startup',
        status: 'new',
      },
    ]);
  });

  it('does nothing until criteria have been saved, so listings are not filtered against defaults', async () => {
    const scorer = fixedScorer();
    const { deps, inserted } = setup({ scorer, unsaved: true });
    const stats = await runScout(deps);
    expect(stats.skipped).toBe('no-criteria');
    expect(scorer.score).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it('skips listings already stored and duplicates within the run, by normalised URL', async () => {
    const scorer = fixedScorer();
    const { deps, inserted } = setup({
      scorer,
      existing: ['https://jobs.example.com/old'],
      sources: [
        source('a', [
          listing({ url: 'https://jobs.example.com/old/?utm_source=x' }),
          listing({ url: 'https://Jobs.example.com/new' }),
        ]),
        source('b', [listing({ url: 'https://jobs.example.com/new#apply' })]),
      ],
    });
    const stats = await runScout(deps);
    expect(stats).toMatchObject({ fetched: 3, duplicates: 2, scored: 1 });
    expect(scorer.score).toHaveBeenCalledTimes(1);
    expect(inserted.map((r) => r.listingUrl)).toEqual(['https://jobs.example.com/new']);
  });

  it('filters excluded companies without calling the scorer', async () => {
    const scorer = fixedScorer();
    const { deps, inserted } = setup({
      scorer,
      criteria: { excludedCompanies: ['acme'] },
      sources: [source('a', [listing({ companyName: ' ACME ' })])],
    });
    const stats = await runScout(deps);
    expect(stats).toMatchObject({ excluded: 1, scored: 0, suggested: 0 });
    expect(scorer.score).not.toHaveBeenCalled();
    expect(inserted).toEqual([
      expect.objectContaining({ status: 'filtered', score: 0, reasons: ['Excluded company'] }),
    ]);
  });

  it('filters listings below the minimum score', async () => {
    const { deps, inserted } = setup({ scorer: fixedScorer({ score: 59 }) });
    const stats = await runScout(deps);
    expect(stats).toMatchObject({ suggested: 0, filtered: 1 });
    expect(inserted[0]?.status).toBe('filtered');
  });

  it('filters listings whose inferred company size is not allowed, but keeps unknown sizes', async () => {
    const criteria = { companySizes: ['scale_up' as const] };
    const corporate = setup({ criteria, scorer: fixedScorer({ companySize: 'corporate' }) });
    await runScout(corporate.deps);
    expect(corporate.inserted[0]?.status).toBe('filtered');

    const unknown = setup({ criteria, scorer: fixedScorer({ companySize: null }) });
    await runScout(unknown.deps);
    expect(unknown.inserted[0]?.status).toBe('new');
  });

  it('filters by track when IC or management is required', async () => {
    const ic = setup({ criteria: { track: 'ic' }, scorer: fixedScorer({ isManagement: true }) });
    await runScout(ic.deps);
    expect(ic.inserted[0]?.status).toBe('filtered');

    const mgmt = setup({ criteria: { track: 'management' }, scorer: fixedScorer() });
    await runScout(mgmt.deps);
    expect(mgmt.inserted[0]?.status).toBe('filtered');
  });

  it('keeps going when a source fails', async () => {
    const broken: ListingSource = {
      name: 'broken',
      fetchListings: async () => {
        throw new Error('timeout');
      },
    };
    const { deps, inserted } = setup({ sources: [broken, source('ok', [listing()])] });
    const stats = await runScout(deps);
    expect(stats.failedSources).toEqual(['broken']);
    expect(inserted).toHaveLength(1);
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('does not store a listing whose scoring failed, so the next run retries it', async () => {
    const scorer: ListingScorer = {
      score: vi.fn(async (l: RawListing) => {
        if (l.url.endsWith('/bad')) throw new Error('refused');
        return fixedScorer().score(l, DEFAULT_SCOUT_CRITERIA);
      }),
    };
    const { deps, inserted } = setup({
      scorer,
      sources: [
        source('a', [
          listing({ url: 'https://x.com/bad' }),
          listing({ url: 'https://x.com/good' }),
        ]),
      ],
    });
    const stats = await runScout(deps);
    expect(stats).toMatchObject({ scored: 1, failed: 1 });
    expect(inserted.map((r) => r.listingUrl)).toEqual(['https://x.com/good']);
  });

  it('skips listings with an invalid URL', async () => {
    const { deps, inserted } = setup({ sources: [source('a', [listing({ url: 'nope' })])] });
    const stats = await runScout(deps);
    expect(stats.invalid).toBe(1);
    expect(inserted).toEqual([]);
  });

  it('passes the saved criteria to the scorer', async () => {
    const scorer = fixedScorer();
    const { deps } = setup({ scorer, criteria: { roles: ['Backend Engineer'] } });
    await runScout(deps);
    expect(scorer.score).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Senior Backend Engineer' }),
      expect.objectContaining({ roles: ['Backend Engineer'] }),
    );
  });
});
