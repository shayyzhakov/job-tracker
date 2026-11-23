import type { User } from 'oidc-client-ts';

/** The part of oidc-client-ts's UserManager the session keeper needs (a fake in tests). */
export interface SessionManager {
  getUser(): Promise<User | null>;
  signinSilent(): Promise<User | null>;
}

/**
 * `ok`: a fresh access token is stored. `ended`: the session is over (no refresh token, or Cognito refused it:
 * revoked, past 30 days, user disabled), so the user has to sign in again. `unreachable`: the refresh could not
 * be done right now (offline, network not back after sleep, timeout); keep the session and try again later.
 */
export type RefreshResult = 'ok' | 'ended' | 'unreachable';

/** Refresh this long before the access token runs out, and on wake/focus when it is this close. */
export const REFRESH_MARGIN_SECONDS = 5 * 60;

/** Cognito answered with an OAuth error (e.g. invalid_grant), as opposed to the request not getting through. */
const isRefusal = (err: unknown) =>
  err instanceof Error && (err.name === 'ErrorResponse' || 'error' in err);

/**
 * Renews the access token with the refresh token. Concurrent callers (timer, tab focus, a 401) share one request,
 * so a burst of failed API calls after wake costs a single refresh.
 */
export function createSessionKeeper(manager: SessionManager) {
  let inflight: Promise<RefreshResult> | undefined;

  const run = async (): Promise<RefreshResult> => {
    const user = await manager.getUser();
    if (!user?.refresh_token) return 'ended';
    try {
      return (await manager.signinSilent()) ? 'ok' : 'ended';
    } catch (err) {
      return isRefusal(err) ? 'ended' : 'unreachable';
    }
  };

  const refresh = (): Promise<RefreshResult> => {
    inflight ??= run().finally(() => {
      inflight = undefined;
    });
    return inflight;
  };

  /** Refresh only if the token is gone, expired or about to expire (used on wake, focus and reconnect). */
  const refreshIfStale = async (): Promise<RefreshResult> => {
    const user = await manager.getUser();
    if (!user) return 'ended';
    const left = user.expires_in;
    if (left !== undefined && left > REFRESH_MARGIN_SECONDS) return 'ok';
    return refresh();
  };

  return { refresh, refreshIfStale };
}

export type SessionKeeper = ReturnType<typeof createSessionKeeper>;

/**
 * A path inside this app to return to after sign-in. Anything else (absolute or protocol-relative URLs,
 * backslash tricks) falls back to the home page, so the sign-in state cannot be turned into an open redirect.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

/** Where the user is now, without the sign-in callback's own query parameters. */
export function currentPath(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location) {
  const params = new URLSearchParams(loc.search);
  if (params.has('code') || params.has('error')) return '/';
  return `${loc.pathname}${loc.search}${loc.hash}`;
}
