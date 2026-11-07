import type { NewOpportunity, OpportunitiesRepository } from '@job-tracker/api/scout';
import {
  normalizeListingUrl,
  type ScoutCriteria,
  type ScoutCriteriaDto,
} from '@job-tracker/shared';
import type { ListingScore, ListingScorer, ListingSource, Logger, RawListing } from './types.js';

export interface ScoutDeps {
  sources: ListingSource[];
  scorer: ListingScorer;
  criteria: { get(): Promise<ScoutCriteriaDto> };
  opportunities: Pick<OpportunitiesRepository, 'existingUrls' | 'insertMany'>;
  logger: Logger;
  /** Parallel scorer calls. */
  concurrency?: number;
}

export interface ScoutStats {
  fetched: number;
  invalid: number;
  duplicates: number;
  excluded: number;
  scored: number;
  failed: number;
  suggested: number;
  filtered: number;
  inserted: number;
  failedSources: string[];
  /** Set when the run did nothing. */
  skipped?: 'no-criteria';
}

interface Candidate {
  url: string;
  source: string;
  listing: RawListing;
}

/** One scout run: fetch → de-duplicate → screen → score → store. */
export async function runScout(deps: ScoutDeps): Promise<ScoutStats> {
  const { sources, scorer, logger, concurrency = 4 } = deps;
  const criteria = await deps.criteria.get();
  const stats: ScoutStats = {
    fetched: 0,
    invalid: 0,
    duplicates: 0,
    excluded: 0,
    scored: 0,
    failed: 0,
    suggested: 0,
    filtered: 0,
    inserted: 0,
    failedSources: [],
  };

  // Without saved criteria every listing would be scored against "no preference" and stored
  // as filtered for good, so wait until the user has configured the scout.
  if (criteria.updatedAt === null) {
    logger.warn('Scout criteria not configured yet; skipping run');
    return { ...stats, skipped: 'no-criteria' };
  }

  // 1. Fetch from every source; one failing source doesn't stop the run.
  const byUrl = new Map<string, Candidate>();
  for (const source of sources) {
    let listings: RawListing[];
    try {
      listings = await source.fetchListings();
    } catch (err) {
      stats.failedSources.push(source.name);
      logger.error('Source failed', { source: source.name, error: String(err) });
      continue;
    }
    stats.fetched += listings.length;
    for (const listing of listings) {
      let url: string;
      try {
        url = normalizeListingUrl(listing.url);
      } catch {
        stats.invalid++;
        logger.warn('Skipping listing with invalid URL', { source: source.name, url: listing.url });
        continue;
      }
      if (byUrl.has(url)) stats.duplicates++;
      else byUrl.set(url, { url, source: source.name, listing });
    }
  }

  // 2. Drop listings seen on earlier runs.
  const existing = await deps.opportunities.existingUrls([...byUrl.keys()]);
  stats.duplicates += existing.size;
  const fresh = [...byUrl.values()].filter((c) => !existing.has(c.url));

  // 3. Screen out excluded companies before paying for a model call.
  const excluded = new Set(criteria.excludedCompanies.map((c) => c.toLowerCase()));
  const rows: NewOpportunity[] = [];
  const toScore: Candidate[] = [];
  for (const c of fresh) {
    if (excluded.has(c.listing.companyName.trim().toLowerCase())) {
      stats.excluded++;
      rows.push(toRow(c, EXCLUDED_SCORE, 'filtered'));
    } else {
      toScore.push(c);
    }
  }

  // 4. Score. A failed listing is not stored, so the next run retries it.
  await mapLimit(toScore, concurrency, async (c) => {
    let result: ListingScore;
    try {
      result = await scorer.score(c.listing, criteria);
    } catch (err) {
      stats.failed++;
      logger.warn('Scoring failed', { url: c.url, error: String(err) });
      return;
    }
    stats.scored++;
    const status = passesFilters(result, criteria) ? 'new' : 'filtered';
    if (status === 'new') stats.suggested++;
    else stats.filtered++;
    rows.push(toRow(c, result, status));
  });

  // 5. Store everything (filtered rows too, so they are never re-scored).
  stats.inserted = await deps.opportunities.insertMany(rows);
  logger.info('Scout run finished', { ...stats });
  return stats;
}

const EXCLUDED_SCORE: ListingScore = {
  score: 0,
  summary: '',
  reasons: ['Excluded company'],
  isManagement: false,
  seniority: null,
  companySize: null,
};

function passesFilters(result: ListingScore, criteria: ScoutCriteria): boolean {
  if (result.score < criteria.minScore) return false;
  if (criteria.track === 'ic' && result.isManagement) return false;
  if (criteria.track === 'management' && !result.isManagement) return false;
  if (
    criteria.companySizes.length > 0 &&
    result.companySize !== null &&
    !criteria.companySizes.includes(result.companySize)
  ) {
    return false;
  }
  return true;
}

function toRow(c: Candidate, result: ListingScore, status: 'new' | 'filtered'): NewOpportunity {
  const { listing } = c;
  const postedAt = listing.postedAt ? new Date(listing.postedAt) : null;
  return {
    listingUrl: c.url,
    source: c.source,
    companyName: listing.companyName.trim(),
    title: listing.title.trim(),
    location: listing.location?.trim() || null,
    description: listing.description ?? '',
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
    score: result.score,
    summary: result.summary,
    reasons: result.reasons,
    isManagement: result.isManagement,
    companySize: result.companySize,
    status,
  };
}

/** Runs `fn` over `items` with at most `limit` in flight. Results are pushed by `fn` itself. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await fn(item);
    }
  });
  await Promise.all(workers);
}
