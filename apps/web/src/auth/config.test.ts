import { describe, expect, it } from 'vitest';
import { readAuthConfig } from './config';

const env = {
  VITE_COGNITO_REGION: 'eu-central-1',
  VITE_COGNITO_USER_POOL_ID: 'eu-central-1_AbC123',
  VITE_COGNITO_CLIENT_ID: 'client123',
  VITE_COGNITO_DOMAIN: 'job-tracker-x.auth.eu-central-1.amazoncognito.com',
};

describe('readAuthConfig', () => {
  it('is disabled when nothing is configured (local development)', () => {
    expect(readAuthConfig({}, 'http://localhost:5173')).toBeNull();
  });

  it('builds OIDC settings for the Cognito pool', () => {
    expect(readAuthConfig(env, 'https://d111.cloudfront.net')).toEqual({
      authority: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_AbC123',
      clientId: 'client123',
      redirectUri: 'https://d111.cloudfront.net/',
      logoutUrl:
        'https://job-tracker-x.auth.eu-central-1.amazoncognito.com/logout?client_id=client123&logout_uri=https%3A%2F%2Fd111.cloudfront.net%2F',
    });
  });

  it('rejects a half-configured pool instead of silently running without login', () => {
    const { VITE_COGNITO_CLIENT_ID: _omit, ...partial } = env;
    expect(() => readAuthConfig(partial, 'https://x')).toThrow(/VITE_COGNITO_CLIENT_ID/);
  });
});
