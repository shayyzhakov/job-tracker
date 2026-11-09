import type { TimelineInterviewDto } from '@job-tracker/shared';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { buildEntries, TimelinePage } from './TimelinePage';

const NOW = new Date('2026-11-09T12:00:00Z');
const round = (id: string, type: TimelineInterviewDto['type'], at: string, company = 'Acme') =>
  ({
    id,
    applicationId: `app-${id}`,
    type,
    scheduledAt: at,
    durationMinutes: null,
    location: null,
    timeUnknown: false,
    debriefedAt: null,
    companyName: company,
    roleName: 'Engineer',
  }) satisfies TimelineInterviewDto;

describe('buildEntries', () => {
  it('puts a now marker between past and upcoming rounds, with a heading per day', () => {
    const entries = buildEntries(
      [
        round('1', 'phone', '2026-11-07T09:00:00Z'),
        round('2', 'technical', '2026-11-12T09:00:00Z'),
        round('3', 'final', '2026-11-12T15:00:00Z'),
      ],
      NOW,
    );
    expect(entries.map((e) => e.kind)).toEqual([
      'day',
      'interview',
      'now',
      'day',
      'interview',
      'interview',
    ]);
  });

  it('still shows the now marker when nothing is upcoming', () => {
    const entries = buildEntries([round('1', 'phone', '2026-11-07T09:00:00Z')], NOW);
    expect(entries.at(-1)?.kind).toBe('now');
  });
});

describe('TimelinePage', () => {
  it('lists rounds of all applications, each linking to its application', async () => {
    server.use(
      http.get('/api/v1/timeline', () =>
        HttpResponse.json([
          round('1', 'phone', new Date(Date.now() - 86_400_000).toISOString(), 'Globex'),
          round('2', 'technical', new Date(Date.now() + 2 * 86_400_000).toISOString()),
        ]),
      ),
    );
    renderRoute(<TimelinePage />);
    const past = await screen.findByRole('link', { name: /Phone interview at Globex/ });
    expect(past).toHaveAttribute('href', '/applications/app-1');
    expect(screen.getByRole('link', { name: /Technical interview at Acme/ })).toHaveAttribute(
      'href',
      '/applications/app-2',
    );
    expect(screen.getByLabelText('Now')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    server.use(http.get('/api/v1/timeline', () => HttpResponse.json([])));
    renderRoute(<TimelinePage />);
    expect(
      await screen.findByText(/No interviews in the past week or planned/),
    ).toBeInTheDocument();
  });
});
