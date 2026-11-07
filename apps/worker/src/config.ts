import { fileURLToPath } from 'node:url';
import { validate } from 'node-cron';
import { z } from 'zod';
import { DEFAULT_SCOUT_MODEL } from './scoring/claude-scorer.js';

export const DEFAULT_FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/listings.json', import.meta.url),
);

/** Source names the worker knows how to build. Real job-board sources get added here. */
export const SOURCE_NAMES = ['fixture'] as const;

const ConfigSchema = z.object({
  // DynamoDB table/endpoint are resolved by resolveDbConfig() (DYNAMODB_TABLE, DYNAMODB_ENDPOINT).
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  SCOUT_SCORER: z.enum(['claude', 'keyword']).default('claude'),
  SCOUT_MODEL: z.string().min(1).default(DEFAULT_SCOUT_MODEL),
  SCOUT_SOURCES: z
    .string()
    .default('fixture')
    .transform((s) => [
      ...new Set(
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.enum(SOURCE_NAMES)).min(1)),
  SCOUT_FIXTURE_PATH: z.string().min(1).default(DEFAULT_FIXTURE_PATH),
  SCOUT_CRON: z.string().default('0 7 * * *').refine(validate, 'Invalid cron expression'),
  SCOUT_TIMEZONE: z.string().default('Asia/Jerusalem'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
