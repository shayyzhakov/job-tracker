import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const renderDetail = () =>
  renderRoute(<ApplicationDetailPage />, {
    path: '/applications/a1',
    route: '/applications/:id',
  });

describe('ApplicationDetailPage', () => {
  it('shows the application, contacts and status timeline', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: /backend engineer/i })).toBeInTheDocument();
    expect(screen.getByText('Dana Levi')).toBeInTheDocument();
    expect(screen.getByText('dana@acme.com')).toBeInTheDocument();
    expect(screen.getByTestId('status-timeline')).toHaveTextContent('Applied');
  });

  it('shows each interview once, scheduled only when it is in the future', async () => {
    const past = '2020-01-01T10:00:00.000Z';
    const future = '2999-01-01T10:00:00.000Z';
    const interview = (id: string, scheduledAt: string) => ({
      id,
      applicationId: 'a1',
      type: 'technical' as const,
      scheduledAt,
      durationMinutes: null,
      location: null,
      timeUnknown: false,
      debriefedAt: null,
      nextStep: null,
      replyBy: null,
      dueAt: null,
      submittedAt: null,
    });
    server.use(
      http.get('/api/v1/applications/:id', () =>
        HttpResponse.json(
          applicationDetail({
            history: [
              {
                id: 'h1',
                applicationId: 'a1',
                fromStatus: null,
                toStatus: 'applied',
                changedAt: past,
                interviewId: null,
              },
              // the status step that created interview i2: must not appear a second time
              {
                id: 'h2',
                applicationId: 'a1',
                fromStatus: 'applied',
                toStatus: 'technical_interview',
                changedAt: past,
                interviewId: 'i2',
              },
            ],
            interviews: [interview('i1', past), interview('i2', future)],
          }),
        ),
      ),
    );
    renderDetail();
    const timeline = await screen.findByTestId('status-timeline');
    expect(screen.getAllByTestId('upcoming-step')).toHaveLength(1);
    expect(timeline.textContent?.match(/Technical interview/g)).toHaveLength(2); // i1 + i2, not h2
  });

  it('asks when the interview is before moving to a round stage', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch('/api/v1/applications/:id/status', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(applicationDetail());
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('combobox', { name: 'Change status' }));
    await user.click(await screen.findByRole('option', { name: 'Technical interview' }));
    expect(await screen.findByText(/when is the technical interview/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/next step/i), 'Revise graphs');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(body).toMatchObject({
        status: 'technical_interview',
        interviewAt: expect.any(String),
        nextStep: 'Revise graphs',
      }),
    );
  });

  it('adds a contact', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/applications/:id/contacts', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'ct2', applicationId: 'a1', name: 'Avi' }, { status: 201 });
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: /add contact/i }));
    await user.type(screen.getByLabelText(/contact name/i), 'Avi');
    await user.type(screen.getByLabelText(/contact role/i), 'Hiring manager');
    await user.click(screen.getByRole('button', { name: /save contact/i }));
    await waitFor(() => expect(body).toMatchObject({ name: 'Avi', role: 'Hiring manager' }));
  });

  it('schedules an interview', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/v1/applications/:id/interviews', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'i9' }, { status: 201 });
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: /schedule interview/i }));
    fireEvent.change(screen.getByLabelText(/date & time/i), {
      target: { value: '2026-11-09T10:30' },
    });
    await user.type(screen.getByLabelText(/location/i), 'Zoom');
    await user.click(screen.getByRole('button', { name: /save interview/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      type: 'technical',
      durationMinutes: 60,
      location: 'Zoom',
    });
    // Sent as an absolute ISO timestamp derived from the local time entered.
    expect(body?.scheduledAt).toBe(new Date('2026-11-09T10:30').toISOString());
  });

  it('requires a date before scheduling', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: /schedule interview/i }));
    await user.click(screen.getByRole('button', { name: /save interview/i }));
    expect(await screen.findByText('Required')).toBeInTheDocument();
  });

  it('edits the application and clears emptied fields', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch('/api/v1/applications/:id', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: /^edit$/i }));
    const role = screen.getByLabelText(/role name/i);
    await user.clear(role);
    await user.type(role, 'Staff Engineer');
    await user.clear(screen.getByLabelText(/listing url/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      roleName: 'Staff Engineer',
      listingUrl: '',
      expectedSalaryIls: 42000,
      company: { name: 'Acme' },
    });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('contacts');
  });

  const round = (over: Record<string, unknown>) => ({
    id: 'r1',
    applicationId: 'a1',
    type: 'technical' as const,
    scheduledAt: '2999-01-01T10:00:00.000Z',
    durationMinutes: 60,
    location: null,
    timeUnknown: false,
    debriefedAt: null,
    nextStep: null,
    replyBy: null,
    dueAt: null,
    submittedAt: null,
    ...over,
  });

  it("shows the current round's next step, not an earlier round's", async () => {
    server.use(
      http.get('/api/v1/applications/:id', () =>
        HttpResponse.json(
          applicationDetail({
            status: 'technical_interview',
            interviews: [
              round({
                id: 'old',
                type: 'phone',
                scheduledAt: '2020-01-01T10:00:00.000Z',
                nextStep: 'Old prep',
              }),
              round({ id: 'r1', nextStep: 'Review system design' }),
            ],
            currentRound: { interviewId: 'r1', phase: 'upcoming' },
          }),
        ),
      ),
    );
    renderDetail();
    const step = await screen.findByTestId('current-step');
    expect(step).toHaveTextContent('Review system design');
    expect(step).not.toHaveTextContent('Old prep');
  });

  it('shows an open home assignment with its due date and marks it submitted', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get('/api/v1/applications/:id', () =>
        HttpResponse.json(
          applicationDetail({
            status: 'home_assignment',
            interviews: [
              round({
                type: 'home_assignment',
                scheduledAt: '2020-01-01T10:00:00.000Z',
                dueAt: '2999-01-05T18:00:00.000Z',
              }),
            ],
            currentRound: { interviewId: 'r1', phase: 'open' },
          }),
        ),
      ),
      http.post('/api/v1/applications/:id/hand-over', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(applicationDetail());
      }),
    );
    const { user } = renderDetail();
    const step = await screen.findByTestId('current-step');
    expect(step).toHaveTextContent('Due by');
    await user.click(screen.getByRole('button', { name: /mark submitted/i }));
    await waitFor(() => expect(body).toEqual({ reason: 'submitted' }));
  });

  it('asks for the expiry when moving to offer, and has no timeline card in the form', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch('/api/v1/applications/:id/status', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(applicationDetail());
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('combobox', { name: 'Change status' }));
    await user.click(await screen.findByRole('option', { name: 'Offer' }));
    fireEvent.change(await screen.findByLabelText(/offer expires/i), {
      target: { value: '2999-01-10T18:00' },
    });
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(body).toMatchObject({ status: 'offer', offerExpiresAt: expect.any(String) }),
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/next step/i)).not.toBeInTheDocument();
  });

  it('shows not found for a missing application', async () => {
    server.use(
      http.get('/api/v1/applications/:id', () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
  });
});
