import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { actionCard, actions, applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const interview = {
  id: 'i1',
  applicationId: 'a1',
  type: 'technical' as const,
  scheduledAt: '2026-11-20T10:00:00.000Z',
  durationMinutes: null,
  location: null,
  interviewerIds: [],
  timeUnknown: false,
  debriefedAt: null,
  nextStep: null,
  replyBy: null,
  dueAt: null,
  submittedAt: null,
};

const debriefCard = actionCard({
  kind: 'debrief',
  urgency: 'soon',
  title: 'Log how the Acme interview went',
  interviewId: 'i1',
});

const renderDetail = () =>
  renderRoute(<ApplicationDetailPage />, { path: '/applications/a1', route: '/applications/:id' });

const useDetail = (needsYou = [debriefCard]) =>
  server.use(
    http.get('/api/v1/applications/:id', () =>
      HttpResponse.json(applicationDetail({ interviews: [interview] })),
    ),
    http.get('/api/v1/actions', () => HttpResponse.json(actions({ needsYou }))),
  );

describe('DebriefBanner', () => {
  it('is hidden when no interview needs a debrief', async () => {
    useDetail([]);
    renderDetail();
    await screen.findByRole('heading', { name: /backend engineer/i });
    expect(screen.queryByTestId('debrief-banner')).not.toBeInTheDocument();
  });

  it('saves the text as a note and marks the interview debriefed', async () => {
    useDetail();
    const calls: string[] = [];
    let patch: unknown;
    server.use(
      http.post('/api/v1/applications/a1/interviews/i1/notes', async ({ request }) => {
        calls.push('note');
        expect(await request.json()).toEqual({ text: 'Went well' });
        return HttpResponse.json({}, { status: 201 });
      }),
      http.patch('/api/v1/applications/a1/interviews/i1', async ({ request }) => {
        calls.push('patch');
        patch = await request.json();
        return HttpResponse.json({ ...interview, debriefedAt: '2026-11-24T09:00:00.000Z' });
      }),
    );
    renderDetail();
    const banner = await screen.findByTestId('debrief-banner');
    fireEvent.click(await screen.findByRole('button', { name: 'Log how it went' }));
    expect(banner).toBeInTheDocument();
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('How it went'), { target: { value: 'Went well' } });
    fireEvent.click(save);
    await waitFor(() => expect(calls).toEqual(['note', 'patch']));
    expect(patch).toEqual({ debriefed: true });
  });
});
