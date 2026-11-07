import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, handleUnauthorized } from './token';

const oidc = vi.hoisted(() => ({
  state: {
    isLoading: false,
    isAuthenticated: false,
    error: undefined as Error | undefined,
    user: undefined as { access_token: string } | undefined,
    signinRedirect: vi.fn(),
    removeUser: vi.fn(),
  },
}));

vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => oidc.state,
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
  });

  it('renders the app directly when login is not configured', () => {
    renderGate(null);
    expect(screen.getByText('secret app')).toBeInTheDocument();
  });

  it('sends unauthenticated visitors to the Cognito hosted login', () => {
    renderGate(config);
    expect(screen.queryByText('secret app')).not.toBeInTheDocument();
    expect(oidc.state.signinRedirect).toHaveBeenCalledOnce();
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

  it('does not start another login when the API rejects a token we already have', () => {
    Object.assign(oidc.state, { isAuthenticated: true, user: { access_token: 'tok-bad' } });
    renderGate(config);
    handleUnauthorized();
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });

  it('shows sign-in errors with a retry instead of looping', async () => {
    oidc.state.error = new Error('invalid_grant');
    renderGate(config);
    expect(screen.getByText(/invalid_grant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(oidc.state.signinRedirect).not.toHaveBeenCalled();
  });
});
