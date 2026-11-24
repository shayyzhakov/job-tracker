import { MantineProvider } from '@mantine/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefreshResult } from './session';
import { getAccessToken, handleUnauthorized } from './token';

const oidc = vi.hoisted(() => ({
  state: {
    isLoading: false,
    isAuthenticated: false,
    error: undefined as Error | undefined,
    user: undefined as { access_token: string } | undefined,
    signinRedirect: vi.fn(),
    removeUser: vi.fn(),
    events: {
      addUserLoaded: vi.fn(() => () => {}),
      addAccessTokenExpiring: vi.fn(() => () => {}),
    },
  },
}));

const keeper = vi.hoisted(() => ({
  refresh: vi.fn<() => Promise<RefreshResult>>(),
  refreshIfStale: vi.fn<() => Promise<RefreshResult>>(),
}));

vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => oidc.state,
}));

vi.mock('./session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session')>()),
  createSessionKeeper: () => keeper,
}));

import { AuthGate } from './AuthGate';

const config = {
  authority: 'https://cognito-idp.eu-central-1.amazonaws.com/pool',
  clientId: 'c',
  redirectUri: 'https://app/',
  logoutUrl: 'https://domain/logout',
};
const seen: (string | undefined)[] = [];
function Child() {
  seen.push(getAccessToken()); // render
  useEffect(() => {
    seen.push(getAccessToken()); // child effects run before the gate's own effects
  }, []);
  return <div>child</div>;
}

const renderGate = (cfg: typeof config | null) =>
  render(
    <MantineProvider env="test">
      <AuthGate config={cfg}>
        <div>secret app</div>
      </AuthGate>
    </MantineProvider>,
  );

describe('AuthGate', () => {
  beforeEach(() => {
    Object.assign(oidc.state, {
      isLoading: false,
      isAuthenticated: false,
      error: undefined,
      user: undefined,
    });
    oidc.state.signinRedirect.mockReset();
    keeper.refresh.mockReset().mockResolvedValue('ok');
    keeper.refreshIfStale.mockReset().mockResolvedValue('ok');
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders the app directly when login is not configured', () => {
    renderGate(null);
    expect(screen.getByText('secret app')).toBeInTheDocument();
  });

  it('sends visitors with no session to sign in, remembering where they were', () => {
    window.history.replaceState({}, '', '/applications/42?tab=notes');
    renderGate(config);
    expect(screen.queryByText('secret app')).not.toBeInTheDocument();
    expect(oidc.state.signinRedirect).toHaveBeenCalledExactlyOnceWith({
      state: { returnTo: '/applications/42?tab=notes' },
    });
  });

  it('shows the app and exposes the access token once signed in', () => {
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok-1' } });
    renderGate(config);
    expect(screen.getByText('secret app')).toBeInTheDocument();
    expect(getAccessToken()).toBe('tok-1');
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });

  it('has the token available to children on their very first render and effects', () => {
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok-first' } });
    seen.length = 0;
    render(
      <MantineProvider env="test">
        <AuthGate config={config}>
          <Child />
        </AuthGate>
      </MantineProvider>,
    );
    expect(seen.every((t) => t === 'tok-first')).toBe(true);
  });

  it('restores an expired stored session with the refresh token instead of signing in again', async () => {
    Object.assign(oidc.state, { user: { access_token: 'old' } }); // stored, but expired
    renderGate(config);
    await waitFor(() => expect(keeper.refresh).toHaveBeenCalledOnce());
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });

  it('goes to sign-in when the stored session cannot be renewed', async () => {
    keeper.refresh.mockResolvedValue('ended');
    Object.assign(oidc.state, { user: { access_token: 'old' } });
    renderGate(config);
    await waitFor(() => expect(oidc.state.signinRedirect).toHaveBeenCalledOnce());
  });

  it('keeps the session and offers a retry when the sign-in service is unreachable', async () => {
    keeper.refresh.mockResolvedValue('unreachable');
    Object.assign(oidc.state, { user: { access_token: 'old' } });
    renderGate(config);
    expect(await screen.findByText(/can't reach the sign-in service/i)).toBeInTheDocument();
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });

  it('renews the session on a 401 and asks the client to retry', async () => {
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok-old' } });
    renderGate(config);
    await expect(handleUnauthorized()).resolves.toBe(true);
    expect(keeper.refresh).toHaveBeenCalledOnce();
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });

  it('sends the user to sign in on a 401 when the session is over', async () => {
    keeper.refresh.mockResolvedValue('ended');
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok-old' } });
    renderGate(config);
    await expect(handleUnauthorized()).resolves.toBe(false);
    expect(oidc.state.signinRedirect).toHaveBeenCalledOnce();
  });

  it('checks the token when the tab becomes visible again (wake from sleep)', async () => {
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok' } });
    renderGate(config);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(keeper.refreshIfStale).toHaveBeenCalled());
  });

  it('retries a failed sign-in once automatically instead of showing an error page', async () => {
    oidc.state.error = new Error('No matching state found in storage');
    renderGate(config);
    await waitFor(() => expect(oidc.state.signinRedirect).toHaveBeenCalledOnce());
    expect(screen.queryByText(/sign-in failed/i)).not.toBeInTheDocument();
  });

  it('shows a repeated sign-in failure with a retry instead of looping', async () => {
    sessionStorage.setItem('auth:lastAutoRetry', String(Date.now()));
    oidc.state.error = new Error('invalid_grant');
    renderGate(config);
    expect(await screen.findByText(/invalid_grant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });
});
