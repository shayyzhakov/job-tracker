/**
 * Guards the "optional side layer" contract: core must work and compile without the gamification
 * layer, and the layer may only touch core through its public extension points.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f));
const rel = (f: string) => relative(SRC, f).replaceAll('\\', '/');
const isLayer = (f: string) => rel(f).startsWith('features/gamification/');
const isTest = (f: string) => /\.test\.tsx?$/.test(f);
const importsOf = (f: string) =>
  [...readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] as string);

describe('gamification is an optional layer', () => {
  it('core never imports the layer, except main.tsx as the single plug point', () => {
    const offenders = files
      .filter((f) => !isLayer(f) && rel(f) !== 'main.tsx' && rel(f) !== 'architecture.test.ts')
      .filter((f) => importsOf(f).some((i) => i.includes('gamification')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('core does not even mention the layer (extension points stay generic)', () => {
    const offenders = files
      .filter((f) => !isLayer(f) && rel(f) !== 'main.tsx' && rel(f) !== 'architecture.test.ts')
      .filter((f) => /gamif/i.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('main.tsx has exactly one plug point', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    expect(main.match(/registerGamification\(\)/g)).toHaveLength(1);
  });

  it('the layer only reaches into core through api/, components/ and lib/', () => {
    const allowed = /^\.\.\/\.\.\/(api|components|lib|theme)(\/|$)/;
    const offenders = files
      .filter((f) => isLayer(f) && !isTest(f))
      .flatMap((f) =>
        importsOf(f)
          .filter((i) => i.startsWith('../../') && !allowed.test(i))
          .map((i) => `${rel(f)} -> ${i}`),
      );
    expect(offenders).toEqual([]);
  });

  it('the layer does not import other features', () => {
    const offenders = files
      .filter((f) => isLayer(f) && !isTest(f))
      .flatMap((f) =>
        importsOf(f)
          .filter((i) => /features\/(?!gamification)/.test(i))
          .map((i) => `${rel(f)} -> ${i}`),
      );
    expect(offenders).toEqual([]);
  });

  it('layer CSS is scoped to the gm- prefix', () => {
    const css = readFileSync(join(SRC, 'features/gamification/gamification.css'), 'utf8');
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
      .match(/[^{}]+(?=\{)/g);
    for (const sel of selectors ?? []) {
      for (const part of sel.split(',')) {
        expect(part.trim(), `unscoped selector: ${part.trim()}`).toMatch(/\.gm-/);
      }
    }
  });
});
