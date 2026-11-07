import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { opportunity } from '../../test/fixtures';
import { renderRoute } from '../../test/render';
import { server } from '../../test/server';
import { SessionContext } from '../auth/AuthGate';
import { Layout } from './Layout';

describe('Suggestions count chip', () => {
  it('shows the number of new suggestions next to the Suggestions tab', async () => {
    server.use(
      http.get('/api/v1/opportunities', () =>
        HttpResponse.json([opportunity({ id: 'a' }), opportunity({ id: 'b' })]),
      ),
    );
    renderRoute(<Layout />);
    const chip = await screen.findByTestId('suggestions-count');
    expect(chip).toHaveTextContent('2');
    expect(chip.closest('a')).toHaveAttribute('href', '/suggestions');
  });

  it('is hidden when there are no new suggestions', async () => {
    server.use(http.get('/api/v1/opportunities', () => HttpResponse.json([])));
    renderRoute(<Layout />);
    await waitFor(() => expect(screen.getByText('Suggestions')).toBeInTheDocument());
    expect(screen.queryByTestId('suggestions-count')).not.toBeInTheDocument();
  });
});

describe('Layout header', () => {
  it('shows the signed-in user as initials, with email and sign-out in a dropdown', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    renderRoute(
      <SessionContext.Provider value={{ signOut, user: { email: 'shay.zhakov@gmail.com' } }}>
        <Layout />
      </SessionContext.Provider>,
    );
    expect(screen.getByText('SZ')).toBeInTheDocument();
    expect(screen.queryByText('shay.zhakov@gmail.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /sign out/i })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('user-badge'));
    expect(await screen.findByTestId('user-email')).toHaveTextContent('shay.zhakov@gmail.com');
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('shows no user area when login is not configured', () => {
    renderRoute(<Layout />);
    expect(screen.queryByTestId('user-badge')).not.toBeInTheDocument();
  });

  it('has no "New application" button in the top bar', () => {
    renderRoute(<Layout />);
    expect(screen.queryByRole('link', { name: /new application/i })).not.toBeInTheDocument();
  });
});
