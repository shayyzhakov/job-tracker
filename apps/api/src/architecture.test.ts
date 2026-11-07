/** Guards the "optional side layer" contract on the API: read-only, and only wired in at the edges. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = __dirname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const files = walk(SRC).filter((f) => f.endsWith('.ts'));
const rel = (f: string) => relative(SRC, f).replaceAll('\\', '/');
const inLayer = (f: string) => rel(f).startsWith('modules/gamification/');

describe('gamification module', () => {
  it('is wired in only from app.ts', () => {
    const offenders = files
      .filter((f) => !inLayer(f) && rel(f) !== 'architecture.test.ts')
      .filter((f) => /modules\/gamification/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual(['app.ts']);
  });

  it('never writes to the database', () => {
    const writes =
      /\b(PutCommand|UpdateCommand|DeleteCommand|BatchWriteCommand|TransactWriteCommand|updateExisting|buildUpdate|batchDelete)\b/;
    const offenders = files
      .filter((f) => inLayer(f) && !f.endsWith('.test.ts'))
      .filter((f) => writes.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('does not import other modules (reads storage only through db/)', () => {
    const offenders = files
      .filter((f) => inLayer(f) && !f.endsWith('.test.ts'))
      .flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)]
          .map((m) => m[1] as string)
          .filter((i) => /\.\.\/(?!\.\/db\/)[a-z-]+\//.test(i) && !i.startsWith('../../db/'))
          .map((i) => `${rel(f)} -> ${i}`),
      );
    expect(offenders).toEqual([]);
  });
});
