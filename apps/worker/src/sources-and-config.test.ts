import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FIXTURE_PATH, loadConfig } from './config.js';
import { FixtureSource } from './sources/fixture-source.js';

describe('FixtureSource', () => {
  it('loads the bundled fixture listings', async () => {
    const listings = await new FixtureSource(DEFAULT_FIXTURE_PATH).fetchListings();
    expect(listings.length).toBeGreaterThanOrEqual(5);
    for (const l of listings) {
      expect(() => new URL(l.url)).not.toThrow();
      expect(l.title).not.toBe('');
      expect(l.companyName).not.toBe('');
    }
  });

  it('rejects a malformed fixture file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scout-'));
    const file = join(dir, 'bad.json');
    await writeFile(file, JSON.stringify([{ title: 'no url' }]));
    await expect(new FixtureSource(file).fetchListings()).rejects.toThrow();
  });
});

describe('loadConfig', () => {
  const base = { DYNAMODB_TABLE: 'job-tracker' };

  it('applies defaults', () => {
    expect(loadConfig(base)).toMatchObject({
      SCOUT_MODEL: 'claude-haiku-5-5',
      SCOUT_SCORER: 'claude',
      SCOUT_SOURCES: ['fixture'],
      SCOUT_FIXTURE_PATH: DEFAULT_FIXTURE_PATH,
      SCOUT_CRON: '0 7 * * *',
      SCOUT_TIMEZONE: 'Asia/Jerusalem',
      SCOUT_SEARCH_MODEL: 'claude-sonnet-5-5',
      SCOUT_SEARCH_MAX_SEARCHES: 15,
      SCOUT_SEARCH_MAX_FETCHES: 25,
      SCOUT_SEARCH_DEADLINE_SECONDS: 600,
    });
  });

  it('accepts the websearch source and numeric search limits', () => {
    const config = loadConfig({
      ...base,
      SCOUT_SOURCES: 'fixture,websearch',
      SCOUT_SEARCH_MAX_SEARCHES: '5',
    });
    expect(config.SCOUT_SOURCES).toEqual(['fixture', 'websearch']);
    expect(config.SCOUT_SEARCH_MAX_SEARCHES).toBe(5);
    expect(() => loadConfig({ ...base, SCOUT_SEARCH_MAX_SEARCHES: '0' })).toThrow();
  });

  it('parses a comma-separated source list and rejects unknown sources', () => {
    expect(loadConfig({ ...base, SCOUT_SOURCES: ' fixture , fixture' }).SCOUT_SOURCES).toEqual([
      'fixture',
    ]);
    expect(() => loadConfig({ ...base, SCOUT_SOURCES: 'linkedin' })).toThrow();
  });

  it('rejects an invalid cron expression and an unknown scorer', () => {
    expect(() => loadConfig({ ...base, SCOUT_CRON: 'every day' })).toThrow();
    expect(() => loadConfig({ ...base, SCOUT_SCORER: 'gpt' })).toThrow();
  });

  it('loads without a database URL (the connection is resolved separately)', () => {
    expect(() => loadConfig({})).not.toThrow();
  });
});
