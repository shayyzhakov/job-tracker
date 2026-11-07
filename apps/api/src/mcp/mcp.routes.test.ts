import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_DB_CONFIG } from '../../test/db-config.js';
import { FakeClientRegistry } from '../../test/fake-client-registry.js';
import { buildApp } from '../app.js';
import { createDb } from '../db/dynamo.js';
import { DEFAULT_REDIRECT_ALLOWLIST } from '../oauth/redirect-allowlist.js';

describe('/mcp over HTTP', () => {
  const { db, close } = createDb(TEST_DB_CONFIG);
  let app: Awaited<ReturnType<typeof buildApp>>;
  let base: string;

  beforeAll(async () => {
    app = await buildApp({
      db,
      mcp: { allowedHosts: ['localhost', '127.0.0.1'] },
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await app.close();
    await close();
  });

  it('serves the tools to an MCP client', async () => {
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('list_applications');
    const result = await client.callTool({
      name: 'get_scout_criteria',
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    await client.close();
  });

  it('rejects requests from hosts that are not allowed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { host: 'evil.example.com', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('only accepts POST', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/mcp',
      headers: { host: 'localhost' },
    });
    expect(res.statusCode).toBe(405);
  });

  it('is not mounted when MCP is disabled', async () => {
    const disabled = await buildApp({ db, mcp: false });
    const res = await disabled.inject({
      method: 'POST',
      url: '/mcp',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    await disabled.close();
  });
});

const oauth = {
  verifier: {
    async verify(token: string) {
      if (token === 'mcp-token') return { sub: 'u1', scopes: ['openid', 'jobtracker/mcp'] };
      if (token === 'web-token') return { sub: 'u1', scopes: ['openid', 'email'] };
      throw new Error('bad token');
    },
  },
  publicUrl: 'https://d111.cloudfront.net',
  scope: 'jobtracker/mcp',
  cognitoDomain: 'jt.auth.us-east-1.amazoncognito.com',
  registry: new FakeClientRegistry(),
  redirectAllowlist: DEFAULT_REDIRECT_ALLOWLIST,
};

describe('/mcp protected by OAuth', () => {
  const { db, close } = createDb(TEST_DB_CONFIG);
  let app: Awaited<ReturnType<typeof buildApp>>;
  const call = (authorization?: string) =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: 'd111.cloudfront.net',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(authorization && { authorization }),
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });

  beforeAll(async () => {
    app = await buildApp({ db, mcp: { allowedHosts: ['*'], oauth } });
  });
  afterAll(async () => {
    await app.close();
    await close();
  });

  it('challenges unauthenticated clients with the resource metadata URL', async () => {
    const res = await call();
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe(
      'Bearer resource_metadata="https://d111.cloudfront.net/.well-known/oauth-protected-resource/mcp", scope="jobtracker/mcp"',
    );
  });

  it('rejects invalid tokens', async () => {
    const res = await call('Bearer nope');
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
  });

  it('rejects valid tokens that lack the MCP scope (e.g. the web app token)', async () => {
    const res = await call('Bearer web-token');
    expect(res.statusCode).toBe(403);
    expect(res.headers['www-authenticate']).toContain('error="insufficient_scope"');
  });

  it('accepts a token with the MCP scope', async () => {
    expect((await call('Bearer mcp-token')).statusCode).toBe(200);
  });

  it('refuses the old static bearer token scheme (no shared secret)', async () => {
    expect((await call('Bearer s3cret')).statusCode).toBe(401);
  });
});

describe('/mcp host wildcard', () => {
  const { db, close } = createDb(TEST_DB_CONFIG);
  afterAll(() => close());

  it('refuses to start with "*" and no OAuth', async () => {
    await expect(buildApp({ db, mcp: { allowedHosts: ['*'] } })).rejects.toThrow(/OAuth/);
  });
});
