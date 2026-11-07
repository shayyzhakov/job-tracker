import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeClientRegistry } from '../../test/fake-client-registry.js';
import { createTestApp, type TestApp } from '../../test/helpers.js';
import { MAX_REGISTERED_CLIENTS } from './oauth.routes.js';
import { DEFAULT_REDIRECT_ALLOWLIST } from './redirect-allowlist.js';

const publicUrl = 'https://d111.cloudfront.net';

describe('OAuth discovery and dynamic client registration', () => {
  let t: TestApp;
  let registry: FakeClientRegistry;
  beforeEach(async () => {
    if (t) await t.close();
    registry = new FakeClientRegistry();
    t = await createTestApp({
      mcp: {
        allowedHosts: ['*'],
        oauth: {
          verifier: { verify: async () => ({ sub: 'u', scopes: [] }) },
          publicUrl,
          scope: 'jobtracker/mcp',
          cognitoDomain: 'jt.auth.us-east-1.amazoncognito.com',
          registry,
          redirectAllowlist: DEFAULT_REDIRECT_ALLOWLIST,
        },
      },
    });
  });
  afterAll(() => t?.close());

  const register = (body: unknown) =>
    t.app.inject({ method: 'POST', url: '/oauth/register', payload: body as object });

  it('serves protected resource metadata for /mcp, unauthenticated', async () => {
    for (const url of [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
    ]) {
      const res = await t.app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        resource: `${publicUrl}/mcp`,
        authorization_servers: [publicUrl],
        scopes_supported: ['jobtracker/mcp'],
      });
    }
  });

  it('serves authorization server metadata pointing at Cognito and our registration endpoint', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server',
    });
    expect(res.json()).toMatchObject({
      issuer: publicUrl,
      authorization_endpoint: 'https://jt.auth.us-east-1.amazoncognito.com/oauth2/authorize',
      token_endpoint: 'https://jt.auth.us-east-1.amazoncognito.com/oauth2/token',
      registration_endpoint: `${publicUrl}/oauth/register`,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  it('registers a client with an allowed redirect URI', async () => {
    const res = await register({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      client_id: 'client-1',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(registry.clients).toHaveLength(1);
  });

  it('accepts loopback redirects on any port', async () => {
    const res = await register({ redirect_uris: ['http://localhost:54321/callback'] });
    expect(res.statusCode).toBe(201);
  });

  it.each([
    'https://evil.example.com/callback',
    'https://claude.ai/other',
    'http://localhost.evil.com:3000/cb',
    'javascript:alert(1)',
    'not a url',
  ])('rejects redirect URI %s', async (uri) => {
    const res = await register({ redirect_uris: [uri] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_redirect_uri');
    expect(registry.clients).toHaveLength(0);
  });

  it('rejects malformed metadata', async () => {
    expect((await register({})).statusCode).toBe(400);
    expect((await register({ redirect_uris: [] })).json().error).toBe('invalid_client_metadata');
  });

  it('answers requests for a confidential client with the public client it actually creates', async () => {
    const res = await register({
      redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
      response_types: ['code'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
    });
    expect(res.json()).not.toHaveProperty('client_secret');
  });

  it.each([
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'https://chatgpt.com/connector/oauth/abc123',
    'https://platform.openai.com/apps-manage/oauth',
  ])('accepts the ChatGPT redirect URI %s', async (uri) => {
    expect((await register({ redirect_uris: [uri] })).statusCode).toBe(201);
  });

  it.each([
    'https://chatgpt.com.evil.com/connector/oauth/abc',
    'https://chatgpt.com/other',
    'https://chatgpt.com/connector/oauthx',
  ])('rejects the lookalike %s', async (uri) => {
    expect((await register({ redirect_uris: [uri] })).statusCode).toBe(400);
  });

  it('deletes the oldest clients beyond the cap', async () => {
    for (let i = 0; i < MAX_REGISTERED_CLIENTS; i++) {
      await registry.create({ displayName: 'x', redirectUris: ['http://localhost:1/cb'] });
    }
    const res = await register({ redirect_uris: ['http://localhost:2/cb'] });
    expect(res.statusCode).toBe(201);
    expect(registry.clients).toHaveLength(MAX_REGISTERED_CLIENTS);
    expect(registry.clients.some((c) => c.clientId === 'client-1')).toBe(false);
  });
});
