import { describe, expect, it } from 'vitest';
import { parseBearer, secretMatches } from './bearer.js';

describe('parseBearer', () => {
  it('extracts the token', () => {
    expect(parseBearer('Bearer abc.def')).toBe('abc.def');
    expect(parseBearer('bearer abc')).toBe('abc');
  });
  it('returns undefined for anything else', () => {
    for (const h of [undefined, '', 'abc', 'Basic abc', 'Bearer', 'Bearer  ']) {
      expect(parseBearer(h)).toBeUndefined();
    }
  });
});

describe('secretMatches', () => {
  it('compares against the expected secret', () => {
    expect(secretMatches('s3cret', 's3cret')).toBe(true);
    expect(secretMatches('s3cre', 's3cret')).toBe(false);
    expect(secretMatches('s3cret!', 's3cret')).toBe(false);
    expect(secretMatches(undefined, 's3cret')).toBe(false);
  });
});
