import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = { DYNAMODB_TABLE: 'job-tracker' };

describe('loadConfig MCP settings', () => {
  it('enables MCP for localhost by default', () => {
    expect(loadConfig(base)).toMatchObject({
      MCP_ENABLED: true,
      MCP_ALLOWED_HOSTS: ['localhost', '127.0.0.1'],
    });
  });

  it('parses MCP_ENABLED and a comma-separated host list', () => {
    const config = loadConfig({
      ...base,
      MCP_ENABLED: 'false',
      MCP_ALLOWED_HOSTS: ' localhost , tracker.local ,',
    });
    expect(config.MCP_ENABLED).toBe(false);
    expect(config.MCP_ALLOWED_HOSTS).toEqual(['localhost', 'tracker.local']);
  });

  it('rejects anything but true or false for MCP_ENABLED', () => {
    expect(() => loadConfig({ ...base, MCP_ENABLED: 'yes' })).toThrow();
  });
});

describe('loadConfig auth and proxy settings', () => {
  it('is open and proxy-agnostic by default', () => {
    expect(loadConfig(base)).toMatchObject({ TRUST_PROXY: false });
    expect(loadConfig(base).COGNITO_USER_POOL_ID).toBeUndefined();
    expect(loadConfig(base).MCP_PUBLIC_URL).toBeUndefined();
  });

  it('requires the Cognito pool id and client id together', () => {
    expect(() => loadConfig({ ...base, COGNITO_USER_POOL_ID: 'eu-central-1_abc' })).toThrow(
      /set together/,
    );
    expect(
      loadConfig({
        ...base,
        COGNITO_USER_POOL_ID: 'eu-central-1_abc',
        COGNITO_CLIENT_ID: 'client',
        MCP_ENABLED: 'false',
      }),
    ).toMatchObject({ COGNITO_CLIENT_ID: 'client' });
  });

  it('needs the public URL and Cognito domain to protect /mcp with OAuth', () => {
    const cognito = {
      ...base,
      COGNITO_USER_POOL_ID: 'us-east-1_abc',
      COGNITO_CLIENT_ID: 'web-client',
    };
    expect(() => loadConfig(cognito)).toThrow(/MCP_PUBLIC_URL and COGNITO_DOMAIN/);
    const ok = loadConfig({
      ...cognito,
      MCP_PUBLIC_URL: 'https://d111.cloudfront.net/',
      COGNITO_DOMAIN: 'jt.auth.us-east-1.amazoncognito.com',
    });
    expect(ok.MCP_PUBLIC_URL).toBe('https://d111.cloudfront.net');
    expect(ok.OAUTH_REDIRECT_ALLOWLIST).toContain('https://claude.ai/api/mcp/auth_callback');
    expect(loadConfig({ ...cognito, MCP_ENABLED: 'false' }).MCP_ENABLED).toBe(false);
  });

  it('parses TRUST_PROXY', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
  });
});
