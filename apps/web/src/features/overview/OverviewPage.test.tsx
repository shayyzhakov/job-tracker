import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { overview } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { OverviewPage } from './OverviewPage';

describe('OverviewPage', () => {
  it('shows KPIs from the overview endpoint', async () => {
    renderRoute(<OverviewPage />);
    expect(await screen.findByTestId('kpi-open')).toHaveTextContent('4');
    expect(screen.getByTestId('kpi-open-hint')).toHaveTextContent('2 active');
    expect(screen.getByTestId('kpi-response-rate')).toHaveTextContent('60%');
    expect(screen.getByTestId('kpi-interviews-week')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-offers')).toHaveTextContent('0');
  });

  it('highlights the next interview', async () => {
    renderRoute(<OverviewPage />);
    const card = await screen.findByTestId('next-interview');
    expect(card).toHaveTextContent('Acme');
    expect(card).toHaveTextContent('Backend Engineer');
    expect(card).toHaveTextContent('Technical');
  });

  it('shows an empty state when nothing is scheduled', async () => {
    server.use(
      http.get('/api/v1/overview', () =>
        HttpResponse.json(
          overview({ nextInterview: null, upcomingInterviews: [], responseRate: null }),
        ),
      ),
    );
    renderRoute(<OverviewPage />);
    expect(await screen.findByText(/no upcoming interviews/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-response-rate')).toHaveTextContent('—');
  });

  it('shows an error when the API fails', async () => {
    server.use(http.get('/api/v1/overview', () => new HttpResponse(null, { status: 500 })));
    renderRoute(<OverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
