import { createHash, timingSafeEqual } from 'node:crypto';

export function parseBearer(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match?.[1];
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time comparison of a plain secret (e.g. a custom header value) with the expected one. */
export function secretMatches(value: string | undefined, expected: string): boolean {
  return value !== undefined && timingSafeEqual(digest(value), digest(expected));
}
