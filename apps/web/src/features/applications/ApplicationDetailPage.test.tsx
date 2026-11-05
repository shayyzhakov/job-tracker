import { screen, waitFor } from '@testing-library/react';
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
