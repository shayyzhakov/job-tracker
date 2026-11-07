import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { NewApplicationPage } from './NewApplicationPage';

describe('NewApplicationPage', () => {
  it('validates required fields before submitting', async () => {
    let called = false;
    server.use(
      http.post('/api/v1/applications', () => {
        called = true;
        return HttpResponse.json(applicationDetail(), { status: 201 });
      }),
    );
    const { user } = renderRoute(<NewApplicationPage />, { path: '/applications/new' });
    await user.click(await screen.findByRole('button', { name: /save application/i }));
    expect(await screen.findAllByText(/required/i)).not.toHaveLength(0);
    expect(called).toBe(false);
  });

  it('submits the application with a contact and navigates to it', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/v1/applications', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(applicationDetail({ id: 'new-id' }), { status: 201 });
      }),
    );
    const { user, router } = renderRoute(<NewApplicationPage />, { path: '/applications/new' });

    await user.type(await screen.findByRole('combobox', { name: /company name/i }), 'Acme');
    await user.type(screen.getByLabelText(/role name/i), 'Engineering Manager');
    await user.click(screen.getByRole('radio', { name: 'Public' }));
    await user.click(screen.getByRole('radio', { name: 'Management' }));
    await user.type(screen.getByLabelText(/expected salary/i), '45000');
    await user.type(screen.getByLabelText(/listing url/i), 'https://jobs.acme.com/1');
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await user.type(screen.getByLabelText(/contact name/i), 'Dana');
    await user.type(screen.getByLabelText(/contact email/i), 'dana@acme.com');
    await user.click(screen.getByRole('button', { name: /save application/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications/new-id'));
    expect(body).toMatchObject({
      company: { name: 'Acme', isPublic: true },
      roleName: 'Engineering Manager',
      isManagement: true,
      expectedSalaryIls: 45000,
      listingUrl: 'https://jobs.acme.com/1',
      status: 'to_apply',
      contacts: [{ name: 'Dana', email: 'dana@acme.com' }],
    });
  });

  it('defaults to a private company and an individual-contributor role', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/v1/applications', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(applicationDetail({ id: 'new-id' }), { status: 201 });
      }),
    );
    const { user, router } = renderRoute(<NewApplicationPage />, { path: '/applications/new' });

    expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Individual contributor' })).toBeChecked();
    await user.type(await screen.findByRole('combobox', { name: /company name/i }), 'Acme');
    await user.type(screen.getByLabelText(/role name/i), 'Engineer');
    await user.click(screen.getByRole('button', { name: /save application/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications/new-id'));
    expect(body).toMatchObject({ company: { isPublic: false }, isManagement: false });
  });
});
