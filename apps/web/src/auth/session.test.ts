import type { User } from 'oidc-client-ts';
import { describe, expect, it, vi } from 'vitest';
import { createSessionKeeper, currentPath, type SessionManager, safeReturnPath } from './session';

const user = (over: Partial<User> = {}) =>
  ({ refresh_token: 'r', expires_in: 10, access_token: 'a', ...over }) as User;

const manager = (over: Partial<SessionManager> = {}): SessionManager => ({
  getUser: vi.fn(async () => user()),
  signinSilent: vi.fn(async () => user({ expires_in: 3600 })),
  ...over,
});

describe('createSessionKeeper', () => {
  it('renews with the refresh token', async () => {
    const m = manager();
    await expect(createSessionKeeper(m).refresh()).resolves.toBe('ok');
    expect(m.signinSilent).toHaveBeenCalledOnce();
  });

  it('shares one request between concurrent callers', async () => {
    const m = manager();
    const k = createSessionKeeper(m);
    await Promise.all([k.refresh(), k.refresh(), k.refresh()]);
    expect(m.signinSilent).toHaveBeenCalledOnce();
  });

  it('ends the session when there is no refresh token', async () => {
    const m = manager({ getUser: vi.fn(async () => user({ refresh_token: undefined })) });
    await expect(createSessionKeeper(m).refresh()).resolves.toBe('ended');
    expect(m.signinSilent).not.toHaveBeenCalled();
  });

  it('ends the session when Cognito refuses the refresh token', async () => {
    const refusal = Object.assign(new Error('invalid_grant'), {
      name: 'ErrorResponse',
      error: 'invalid_grant',
    });
    const m = manager({ signinSilent: vi.fn().mockRejectedValue(refusal) });
    await expect(createSessionKeeper(m).refresh()).resolves.toBe('ended');
  });

  it('keeps the session when the network is not there (e.g. right after wake)', async () => {
    const m = manager({
      signinSilent: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    await expect(createSessionKeeper(m).refresh()).resolves.toBe('unreachable');
  });

  it('only refreshes on wake when the token is close to expiring', async () => {
    const fresh = manager({ getUser: vi.fn(async () => user({ expires_in: 3000 })) });
    await expect(createSessionKeeper(fresh).refreshIfStale()).resolves.toBe('ok');
    expect(fresh.signinSilent).not.toHaveBeenCalled();

    const stale = manager({ getUser: vi.fn(async () => user({ expires_in: -100 })) });
    await createSessionKeeper(stale).refreshIfStale();
    expect(stale.signinSilent).toHaveBeenCalledOnce();
  });
});

describe('safeReturnPath', () => {
  it('keeps in-app paths', () => {
    expect(safeReturnPath('/applications/1?tab=notes#x')).toBe('/applications/1?tab=notes#x');
  });
  it('rejects anything that could leave the app', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'evil', undefined, 42])
      expect(safeReturnPath(bad)).toBe('/');
  });
});

describe('currentPath', () => {
  it('returns the path, query and hash', () => {
    expect(currentPath({ pathname: '/companies', search: '?q=a', hash: '#b' })).toBe(
      '/companies?q=a#b',
    );
  });
  it('does not return to the sign-in callback itself', () => {
    expect(currentPath({ pathname: '/', search: '?code=x&state=y', hash: '' })).toBe('/');
  });
});
