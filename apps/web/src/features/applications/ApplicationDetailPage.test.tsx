import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const renderDetail = () =>
  renderRoute(<ApplicationDetailPage />, { path: '/applications/a1', route: '/applications/:id' });

describe('ApplicationDetailPage', () => {
  it('shows the application, contacts and status timeline', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: /backend engineer/i })).toBeInTheDocument();
    expect(screen.getByText('Dana Levi')).toBeInTheDocument();
    expect(screen.getByText('dana@acme.com')).toBeInTheDocument();
    expect(screen.getByTestId('status-timeline')).toHaveTextContent('Applied');
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
    expect(body).toMatchObject({ type: 'technical', durationMinutes: 60, location: 'Zoom' });
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
