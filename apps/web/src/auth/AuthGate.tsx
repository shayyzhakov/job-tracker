import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import type { AuthConfig } from './config';
import type { SessionUser } from './initials';
import {
  createSessionKeeper,
  currentPath,
  REFRESH_MARGIN_SECONDS,
  type SessionKeeper,
  safeReturnPath,
} from './session';
import { configureAuth } from './token';

export interface Session {
  signOut: () => void;
  user: SessionUser;
}

/** Present only when login is configured. */
export const SessionContext = createContext<Session | undefined>(undefined);
export const useSession = () => useContext(SessionContext);

/** Sign-in failures are retried automatically at most once per this window, so a broken login cannot loop. */
const AUTO_RETRY_WINDOW_MS = 60_000;
const AUTO_RETRY_KEY = 'auth:lastAutoRetry';

function mayAutoRetry() {
  try {
    const last = Number(sessionStorage.getItem(AUTO_RETRY_KEY) ?? 0);
    if (Date.now() - last < AUTO_RETRY_WINDOW_MS) return false;
    sessionStorage.setItem(AUTO_RETRY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function Gate({
  config,
  keeper,
  children,
}: {
  config: AuthConfig;
  keeper: SessionKeeper;
  children: ReactNode;
}) {
  const auth = useAuth();
  const redirected = useRef(false);
  const tokenRef = useRef<string | undefined>(undefined);
  // Restoring a stored session whose access token ran out. `unreachable`: the refresh could not get through
  // (offline right after wake), so the session is kept and the user can retry instead of signing in again.
  const [restore, setRestore] = useState<'idle' | 'running' | 'unreachable' | 'done'>('idle');
  const [showError, setShowError] = useState(false);
  tokenRef.current = auth.user?.access_token;

  const signIn = useCallback(() => {
    if (redirected.current) return;
    redirected.current = true;
    void auth.signinRedirect({ state: { returnTo: currentPath() } });
  }, [auth.signinRedirect]);

  /** Renews the session; sends the user to sign in when it is over. Resolves true when a fresh token is stored. */
  const renew = useCallback(
    async (onlyIfStale: boolean) => {
      const result = await (onlyIfStale ? keeper.refreshIfStale() : keeper.refresh());
      if (result === 'ended') signIn();
      return result === 'ok';
    },
    [keeper, signIn],
  );

  // Registered during render, not in an effect: children's effects (their first API calls) run before this
  // component's effects, so an effect here would let them go out without a token and loop through login.
  configureAuth({ getToken: () => tokenRef.current, onUnauthorized: () => renew(false) });

  const settled = !auth.isLoading && !auth.error;
  const needsRestore = settled && !!auth.user && !auth.isAuthenticated;
  const needsLogin = settled && !auth.user;

  // Reopened after the access token ran out (tab closed overnight, laptop asleep): use the refresh token
  // instead of a full sign-in. Only when Cognito refuses it does the user see the sign-in page.
  useEffect(() => {
    if (!needsRestore || restore !== 'idle') return;
    setRestore('running');
    void keeper.refresh().then((result) => {
      if (result === 'ended') signIn();
      setRestore(result === 'unreachable' ? 'unreachable' : 'done');
    });
  }, [needsRestore, restore, keeper, signIn]);

  useEffect(() => {
    if (needsLogin) signIn();
  }, [needsLogin, signIn]);

  // Keep the access token fresh: shortly before it expires, and whenever the tab comes back (focus, wake from
  // sleep, network back). Timers do not run while the computer sleeps, so the wake check does the real work.
  useEffect(() => {
    // The new token is stored (and this event raised) before the refresh resolves, so a retried request uses it.
    const onLoaded = auth.events.addUserLoaded((user) => {
      tokenRef.current = user.access_token;
    });
    const onExpiring = auth.events.addAccessTokenExpiring(() => void renew(false));
    const check = () => {
      if (document.visibilityState === 'visible') void renew(true);
    };
    const reconnect = () => {
      setRestore((s) => (s === 'unreachable' ? 'idle' : s));
      check();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('online', reconnect);
    return () => {
      onLoaded();
      onExpiring();
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', reconnect);
    };
  }, [auth.events, renew]);

  // A failed sign-in callback (a stale or reused sign-in link, a login page left open too long) gets one
  // automatic fresh sign-in instead of an error page. A repeat failure within a minute is shown, so it cannot loop.
  useEffect(() => {
    if (!auth.error) return;
    if (!redirected.current && mayAutoRetry()) signIn();
    else setShowError(true);
  }, [auth.error, signIn]);

  if (auth.error && showError) {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Alert color="red" title="Sign-in failed">
            {auth.error.message}
          </Alert>
          <Button
            onClick={() => {
              redirected.current = false;
              signIn();
            }}
          >
            Try again
          </Button>
        </Stack>
      </Center>
    );
  }
  if (restore === 'unreachable' && !auth.isAuthenticated) {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Alert color="yellow" title="Can't reach the sign-in service">
            You are still signed in. Check your connection and try again.
          </Alert>
          <Button onClick={() => setRestore('idle')}>Try again</Button>
        </Stack>
      </Center>
    );
  }
  if (!auth.isAuthenticated || auth.error) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  const signOut = () => {
    void auth.removeUser().then(() => window.location.assign(config.logoutUrl));
  };
  const profile = auth.user?.profile;
  const session: Session = {
    signOut,
    user: {
      name: typeof profile?.name === 'string' ? profile.name : undefined,
      email: typeof profile?.email === 'string' ? profile.email : undefined,
    },
  };
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/**
 * Wraps the app with Cognito login (OIDC code + PKCE). With no config it is a pass-through.
 * `onReturn` receives the in-app path the user was on before being sent to sign in (router navigation).
 */
export function AuthGate({
  config,
  onReturn,
  children,
}: {
  config: AuthConfig | null;
  onReturn?: (path: string) => void;
  children: ReactNode;
}) {
  if (!config) return <>{children}</>;
  return (
    <ConfiguredGate config={config} onReturn={onReturn}>
      {children}
    </ConfiguredGate>
  );
}

function ConfiguredGate({
  config,
  onReturn,
  children,
}: {
  config: AuthConfig;
  onReturn?: (path: string) => void;
  children: ReactNode;
}) {
  const [manager] = useState(
    () =>
      new UserManager({
        authority: config.authority,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: 'openid email',
        response_type: 'code',
        // Renewal is driven by the Gate (expiring event, wake, focus, 401) so a failed refresh while the network
        // is still coming back does not surface as a sign-in error.
        automaticSilentRenew: false,
        accessTokenExpiringNotificationTimeInSeconds: REFRESH_MARGIN_SECONDS,
        // localStorage (default is sessionStorage) so the session survives closing the tab/browser.
        userStore: new WebStorageStateStore({ store: window.localStorage }),
      }),
  );
  const [keeper] = useState(() => createSessionKeeper(manager));
  return (
    <AuthProvider
      userManager={manager}
      onSigninCallback={(user) => {
        const to = safeReturnPath((user?.state as { returnTo?: unknown } | undefined)?.returnTo);
        window.history.replaceState({}, document.title, to);
        onReturn?.(to);
      }}
    >
      <Gate config={config} keeper={keeper}>
        {children}
      </Gate>
    </AuthProvider>
  );
}
