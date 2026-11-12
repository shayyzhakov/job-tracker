import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { applicationDetail, opportunity } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { SuggestionsPage } from './SuggestionsPage';

const render = () => renderRoute(<SuggestionsPage />, { path: '/suggestions' });

describe('SuggestionsPage', () => {
  it('shows each suggestion with its score, summary and reasons', async () => {
    render();
    const card = await screen.findByTestId('suggestion-o1');
    expect(card).toHaveTextContent('Senior Backend Engineer');
    expect(card).toHaveTextContent('Nimbus Data');
    expect(card).toHaveTextContent('Tel Aviv');
    expect(card).toHaveTextContent('88');
    expect(card).toHaveTextContent('Node.js services on Postgres and Kafka.');
    expect(card).toHaveTextContent('Tel Aviv hybrid');
    expect(card).toHaveTextContent('Startup');
    expect(within(card).getByRole('link', { name: /view listing/i })).toHaveAttribute(
      'href',
      'https://boards.example.com/nimbus/jobs/1001',
    );
  });

  it('promotes a suggestion and opens the new application', async () => {
    let promoted: string | undefined;
    server.use(
      http.post('/api/v1/opportunities/:id/promote', ({ params }) => {
        promoted = String(params.id);
        return HttpResponse.json(applicationDetail({ id: 'app-9' }), { status: 201 });
      }),
    );
    const { user, router } = render();
    const card = await screen.findByTestId('suggestion-o1');
    await user.click(within(card).getByRole('button', { name: /add to applications/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/applications/app-9'));
    expect(promoted).toBe('o1');
  });

  it('dismisses a suggestion', async () => {
    let dismissed = false;
    server.use(
      http.post('/api/v1/opportunities/:id/dismiss', () => {
        dismissed = true;
        return HttpResponse.json(opportunity({ status: 'dismissed' }));
      }),
      http.get('/api/v1/opportunities', () => HttpResponse.json(dismissed ? [] : [opportunity()])),
    );
    const { user } = render();
    const card = await screen.findByTestId('suggestion-o1');
    await user.click(within(card).getByRole('button', { name: /dismiss/i }));
    await waitFor(() => expect(screen.queryByTestId('suggestion-o1')).not.toBeInTheDocument());
    expect(dismissed).toBe(true);
  });

  it('shows an empty state that links to the scout settings', async () => {
    server.use(http.get('/api/v1/opportunities', () => HttpResponse.json([])));
    render();
    expect(await screen.findByText(/no new suggestions/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'scout settings' })).toHaveAttribute(
      'href',
      '/scout/settings',
    );
  });

  it('links to the company prioritization page', async () => {
    render();
    expect(await screen.findByRole('link', { name: /prioritize companies/i })).toHaveAttribute(
      'href',
      '/scout/companies',
    );
  });

  it('shows an error when the API fails', async () => {
    server.use(http.get('/api/v1/opportunities', () => new HttpResponse(null, { status: 500 })));
    render();
    expect(await screen.findByText(/could not load suggestions/i)).toBeInTheDocument();
  });
});
