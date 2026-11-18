import { describe, expect, it } from 'vitest';
import { linkLabel, splitLinks } from './LinkifiedText';

describe('splitLinks', () => {
  it('extracts urls and keeps trailing punctuation outside', () => {
    expect(splitLinks('See https://www.acme.com/jobs/123, then apply.')).toEqual([
      'See ',
      { url: 'https://www.acme.com/jobs/123' },
      ', then apply.',
    ]);
  });
  it('returns plain text untouched', () => {
    expect(splitLinks('no links')).toEqual(['no links']);
  });
});

describe('linkLabel', () => {
  it('shows host and first path segment only', () => {
    expect(linkLabel('https://www.acme.com/jobs/123?x=1')).toBe('acme.com/jobs');
    expect(linkLabel('https://acme.com/')).toBe('acme.com');
  });
});
