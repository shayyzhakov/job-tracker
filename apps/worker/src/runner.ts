// Pieces shared by the local entry point (main.ts) and the Lambda handler (handler.ts).
import {
  createDb,
  DynamoCompaniesRepository,
  DynamoOpportunitiesRepository,
  DynamoScoutCriteriaRepository,
  resolveDbConfig,
} from '@job-tracker/api/scout';
import type { Config } from './config.js';
import { runScout } from './run-scout.js';
import { ClaudeScorer } from './scoring/claude-scorer.js';
import { KeywordScorer } from './scoring/keyword-scorer.js';
import { FixtureSource } from './sources/fixture-source.js';
import { WebSearchSource } from './sources/web-search-source.js';
import type { ListingScorer, ListingSource, Logger } from './types.js';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export function createLogger(level: Config['LOG_LEVEL']): Logger {
  const min = level === 'silent' ? Number.POSITIVE_INFINITY : LEVELS.indexOf(level);
  const log = (lvl: (typeof LEVELS)[number]) => (msg: string, data?: Record<string, unknown>) => {
    if (LEVELS.indexOf(lvl) < min) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...data });
    (lvl === 'error' ? console.error : console.log)(line);
  };
  return { info: log('info'), warn: log('warn'), error: log('error') };
}

function buildSources(config: Config, logger: Logger): ListingSource[] {
  const factories: Record<Config['SCOUT_SOURCES'][number], () => ListingSource> = {
    fixture: () => new FixtureSource(config.SCOUT_FIXTURE_PATH),
    websearch: () =>
      new WebSearchSource({
        model: config.SCOUT_SEARCH_MODEL,
        maxSearches: config.SCOUT_SEARCH_MAX_SEARCHES,
        maxFetches: config.SCOUT_SEARCH_MAX_FETCHES,
        deadlineMs: config.SCOUT_SEARCH_DEADLINE_SECONDS * 1000,
        logger,
      }),
  };
  return config.SCOUT_SOURCES.map((name) => factories[name]());
}

function buildScorer(config: Config): ListingScorer {
  return config.SCOUT_SCORER === 'keyword'
    ? new KeywordScorer()
    : new ClaudeScorer({ model: config.SCOUT_MODEL });
}

/** One scout pass against the configured DynamoDB table; opens and closes its own connection. */
export async function runScoutOnce(config: Config, logger: Logger) {
  const { db, close } = createDb(resolveDbConfig());
  try {
    return await runScout({
      sources: buildSources(config, logger),
      scorer: buildScorer(config),
      criteria: new DynamoScoutCriteriaRepository(db),
      companies: new DynamoCompaniesRepository(db),
      opportunities: new DynamoOpportunitiesRepository(db),
      logger,
    });
  } finally {
    await close();
  }
}
