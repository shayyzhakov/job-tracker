import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { actionCard, actions } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { snoozeUntil } from './ActionCard';
import { TodayPage } from './TodayPage';

const serve = (data = actions()) =>
  server.use(http.get('/api/v1/actions', () => HttpResponse.json(data)));

describe('TodayPage', () => {
  it('shows an empty state with the next check-in when nothing needs the user', async () => {
    serve(
      actions({
        waiting: [
          {
            applicationId: 'a1',
            company: 'Acme',
            roleName: 'Backend Engineer',
            state: 'waiting',
            subtitle: 'Applied 3 days ago',
            checkInAt: '2026-11-16T10:00:00.000Z',
          },
        ],
        counts: { needsYou: 0, overdue: 0, waiting: 1 },
      }),
    );
    renderRoute(<TodayPage />);
    expect(await screen.findByTestId('today-empty')).toHaveTextContent('Next check-in 16 Nov 2026');
    expect(screen.getByTestId('today-summary')).toHaveTextContent('0 need you · 1 waiting');
    expect(screen.getByTestId('today-waiting')).toHaveTextContent('Acme');
  });

  it('groups cards by urgency and shows what was hidden', async () => {
    serve(
      actions({
        needsYou: [
          actionCard({
            kind: 'respond_offer',
            urgency: 'deadline',
            title: 'Respond to the Acme offer',
          }),
          actionCard({
            applicationId: 'a2',
            urgency: 'soon',
            title: 'Schedule it',
            kind: 'schedule_interview',
          }),
          actionCard({
            applicationId: 'a3',
            urgency: 'nudge',
            title: 'Apply to Fiverr or drop it',
            kind: 'apply',
          }),
        ],
        hiddenNudges: 2,
        counts: { needsYou: 5, overdue: 0, waiting: 0 },
      }),
    );
    renderRoute(<TodayPage />);
    const cards = await screen.findAllByTestId('action-card');
    expect(cards.map((c) => c.dataset.kind)).toEqual([
      'respond_offer',
      'schedule_interview',
      'apply',
    ]);
    expect(screen.getByText('Deadlines and overdue')).toBeInTheDocument();
    expect(screen.getByTestId('hidden-nudges')).toHaveTextContent('+2 more nudges');
  });

  it('"Followed up" hands the ball over and refreshes the list', async () => {
    let list = actions({
      needsYou: [actionCard({ kind: 'follow_up' })],
      counts: { needsYou: 1, overdue: 0, waiting: 0 },
    });
    let body: unknown;
    server.use(
      http.get('/api/v1/actions', () => HttpResponse.json(list)),
      http.post('/api/v1/applications/:id/hand-over', async ({ request }) => {
        body = await request.json();
        list = actions();
        return HttpResponse.json({});
      }),
    );
    const { user } = renderRoute(<TodayPage />);
    const card = await screen.findByTestId('action-card');
    await user.click(within(card).getByRole('button', { name: 'Followed up' }));
    await waitFor(() => expect(screen.getByTestId('today-empty')).toBeInTheDocument());
    expect(body).toEqual({ reason: 'followed_up' });
  });

  it('snoozes with a preset', async () => {
    let body: { until: string } | undefined;
    serve(actions({ needsYou: [actionCard()], counts: { needsYou: 1, overdue: 0, waiting: 0 } }));
    server.use(
      http.post('/api/v1/applications/:id/snooze', async ({ request }) => {
        body = (await request.json()) as { until: string };
        return HttpResponse.json({});
      }),
    );
    const { user } = renderRoute(<TodayPage />);
    await user.click(await screen.findByRole('button', { name: /snooze acme/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'In 3 days' }));
    await waitFor(() => expect(body).toBeDefined());
    const days = (new Date(body?.until ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);
  });

  it('"Mark ghosted" changes the status', async () => {
    let body: Record<string, unknown> | undefined;
    serve(actions({ needsYou: [actionCard()], counts: { needsYou: 1, overdue: 0, waiting: 0 } }));
    server.use(
      http.patch('/api/v1/applications/:id/status', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderRoute(<TodayPage />);
    await user.click(await screen.findByRole('button', { name: 'Mark ghosted' }));
    await waitFor(() => expect(body?.status).toBe('ghosted'));
  });
});

describe('snoozeUntil', () => {
  const now = new Date(2026, 10, 5, 15, 30);
  it('returns tomorrow at 09:00, +3 days and +7 days', () => {
    expect(snoozeUntil('tomorrow', now)).toEqual(new Date(2026, 10, 6, 9, 0));
    expect(snoozeUntil('three_days', now)).toEqual(new Date(2026, 10, 8, 15, 30));
    expect(snoozeUntil('next_week', now)).toEqual(new Date(2026, 10, 12, 15, 30));
  });
});
