import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../test/helpers.js';
import type { TokenVerifier } from './token-verifier.js';

const verifier: TokenVerifier = {
  async verify(token) {
    if (token !== 'good-token') throw new Error('bad token');
    return { sub: 'user-1', scopes: [] };
  },
};

describe('API auth', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ auth: { verifier } });
  });
  afterAll(() => t.close());

  it('rejects API calls without a token', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/v1/applications',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed and invalid tokens', async () => {
    for (const authorization of ['good-token', 'Basic abc', 'Bearer nope', 'Bearer ']) {
      const res = await t.app.inject({
        method: 'GET',
        url: '/api/v1/applications',
        headers: { authorization },
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it('allows API calls with a valid bearer token', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/v1/applications',
      headers: { authorization: 'Bearer good-token' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('keeps /health open for load balancer checks', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });
});

describe('API without auth configured', () => {
  it('stays open (local development)', async () => {
    const t = await createTestApp();
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/v1/applications',
    });
    expect(res.statusCode).toBe(200);
    await t.close();
  });
});
