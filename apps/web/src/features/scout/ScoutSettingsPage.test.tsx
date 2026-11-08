import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { scoutCriteria } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ScoutSettingsPage } from './ScoutSettingsPage';

const render = () => renderRoute(<ScoutSettingsPage />, { path: '/scout/settings' });

describe('ScoutSettingsPage', () => {
  it('loads the saved criteria into the form', async () => {
    render();
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
    expect(screen.getAllByText('Senior')[0]).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Either' })).toBeChecked();
  });

  it('saves edited criteria', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.put('/api/v1/scout/criteria', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(scoutCriteria(body));
      }),
    );
    const { user } = render();
    await screen.findByText('Backend Engineer');

    await user.type(screen.getByRole('combobox', { name: 'Roles' }), 'Platform Engineer{Enter}');
    await user.click(screen.getByRole('radio', { name: 'Individual contributor' }));
    await user.click(screen.getByRole('checkbox', { name: 'Scale-up' }));
    await user.type(screen.getByRole('combobox', { name: 'Excluded companies' }), 'Globex{Enter}');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({
      roles: ['Backend Engineer', 'Platform Engineer'],
      seniorities: ['senior'],
      track: 'ic',
      locations: ['Tel Aviv'],
      companySizes: ['scale_up'],
      excludedCompanies: ['Globex'],
      minScore: 60,
    });
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('explains that the scout is idle until criteria are saved', async () => {
    server.use(
      http.get('/api/v1/scout/criteria', () =>
        HttpResponse.json(scoutCriteria({ roles: [], updatedAt: null })),
      ),
    );
    render();
    expect(await screen.findByText(/won't run until you save/i)).toBeInTheDocument();
  });

  it('shows an error when saving fails', async () => {
    server.use(
      http.put('/api/v1/scout/criteria', () =>
        HttpResponse.json({ message: 'Validation failed' }, { status: 400 }),
      ),
    );
    const { user } = render();
    await screen.findByText('Backend Engineer');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/validation failed/i)).toBeInTheDocument();
  });
});
