import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider, useAuth } from 'react-oidc-context';
import type { AuthConfig } from './config';
import type { SessionUser } from './initials';
import { configureAuth } from './token';

export interface Session {
  signOut: () => void;
  user: SessionUser;
}

/** Present only when login is configured. */
export const SessionContext = createContext<Session | undefined>(undefined);
export const useSession = () => useContext(SessionContext);

function Gate({ config, children }: { config: AuthConfig; children: ReactNode }) {
  const auth = useAuth();
  const redirected = useRef(false);
  const token = auth.user?.access_token;

  // Registered during render, not in an effect: children's effects (their first API calls) run before this
  // component's effects, so an effect here would let them go out without a token and loop through login.
  // Only an unauthenticated visitor (no token) is sent to login on a 401; with a token a 401 is a real error.
  configureAuth({
    getToken: () => token,
    onUnauthorized: () => {
      if (!token) void auth.signinRedirect();
    },
  });

  const needsLogin = !auth.isLoading && !auth.isAuthenticated && !auth.error;
  useEffect(() => {
    if (needsLogin && !redirected.current) {
      redirected.current = true;
      void auth.signinRedirect();
    }
  }, [needsLogin, auth.signinRedirect]);

  if (auth.error) {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Alert color="red" title="Sign-in failed">
            {auth.error.message}
          </Alert>
          <Button
            onClick={() => {
              redirected.current = true;
              void auth.signinRedirect();
            }}
          >
            Try again
          </Button>
        </Stack>
      </Center>
    );
  }
  if (!auth.isAuthenticated) {
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

/** Wraps the app with Cognito login (OIDC code + PKCE). With no config it is a pass-through. */
export function AuthGate({ config, children }: { config: AuthConfig | null; children: ReactNode }) {
  if (!config) return <>{children}</>;
  return (
    <AuthProvider
      authority={config.authority}
      client_id={config.clientId}
      redirect_uri={config.redirectUri}
      scope="openid email"
      response_type="code"
      automaticSilentRenew
      // localStorage (default is sessionStorage) so the session survives closing the tab/browser.
      userStore={new WebStorageStateStore({ store: window.localStorage })}
      onSigninCallback={() =>
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    >
      <Gate config={config}>{children}</Gate>
    </AuthProvider>
  );
}
