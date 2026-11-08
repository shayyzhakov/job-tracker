import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { actionCard, actions, application, applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationsPage } from './ApplicationsPage';

describe('ApplicationsPage', () => {
  it('lists applications with company, role, IC badge and status', async () => {
    renderRoute(<ApplicationsPage />, { path: '/applications' });
    const row = (await screen.findByText('Acme')).closest('tr');
    if (!row) throw new Error('row not found');
    expect(within(row).getByText('Backend Engineer')).toBeInTheDocument();
    expect(within(row).getByRole('combobox', { name: 'Status for Acme' })).toHaveValue('Applied');
    expect(within(row).getByText('IC')).toBeInTheDocument();
    expect(screen.queryByText('Expected salary')).not.toBeInTheDocument();
  });

  it('flags only the applications that need you', async () => {
    server.use(
      http.get('/api/v1/applications', () =>
        HttpResponse.json([
          application(),
          application({
            id: 'a2',
            company: { ...application().company, id: 'c2', name: 'Globex' },
          }),
          application({
            id: 'a3',
            company: { ...application().company, id: 'c3', name: 'Initech' },
          }),
        ]),
      ),
      http.get('/api/v1/actions', () =>
        HttpResponse.json(
          actions({
            needsYou: [actionCard({ applicationId: 'a1' })],
            flagged: [{ applicationId: 'a1', title: 'Follow up' }],
            scheduled: [
              {
                applicationId: 'a2',
                company: 'Globex',
                roleName: 'Backend Engineer',
                state: 'scheduled',
                subtitle: 'Interview in 5 days',
                checkInAt: '2026-11-12T10:00:00.000Z',
              },
            ],
            waiting: [
              {
                applicationId: 'a3',
                company: 'Initech',
                roleName: 'Backend Engineer',
                state: 'waiting',
                subtitle: 'Applied 3 days ago',
                checkInAt: '2026-11-16T10:00:00.000Z',
              },
            ],
          }),
        ),
      ),
    );
    renderRoute(<ApplicationsPage />, { path: '/applications' });
    await waitFor(() => expect(screen.getAllByTestId('needs-you')).toHaveLength(1));
    const flagged = (company: string) =>
      within(screen.getByText(company).closest('tr') as HTMLElement).queryByTestId('needs-you');
    expect(flagged('Acme')).toBeInTheDocument();
    expect(flagged('Globex')).not.toBeInTheDocument();
    expect(flagged('Initech')).not.toBeInTheDocument();
  });

  it('filters by role type and company type', async () => {
    const corp = {
      ...application().company,
      id: 'c2',
      name: 'BigCorp',
      isPublic: true,
      size: 'corporate' as const,
    };
    server.use(
      http.get('/api/v1/applications', () =>
        HttpResponse.json([
          application(),
          application({
            id: 'a2',
            company: corp,
            roleName: 'VP R&D',
            isManagement: true,
          }),
        ]),
      ),
    );
    const { user } = renderRoute(<ApplicationsPage />, {
      path: '/applications',
    });
    await screen.findByText('BigCorp');
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(
      within(screen.getByText('BigCorp').closest('tr') as HTMLElement).getByText('Corporate'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Role type' }));
    await user.click(await screen.findByRole('option', { name: 'Management' }));
    expect(screen.getByText('BigCorp')).toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('combobox', { name: 'Company size' }));
    await user.click(await screen.findByRole('option', { name: 'Scale-up' }));
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('BigCorp')).not.toBeInTheDocument();
  });

  it('sends search and active filters to the API', async () => {
    const seen: string[] = [];
    server.use(
      http.get('/api/v1/applications', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json([application()]);
      }),
    );
    const { user } = renderRoute(<ApplicationsPage />, {
      path: '/applications',
    });
    await screen.findByText('Acme');
    expect(seen[0]).toContain('active=true');

    await user.type(screen.getByPlaceholderText(/search/i), 'acme');
    await waitFor(() => expect(seen.at(-1)).toContain('q=acme'));
  });

  it('changes status inline', async () => {
    let body: unknown;
    server.use(
      http.patch('/api/v1/applications/:id/status', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(applicationDetail({ status: 'phone_interview' }));
      }),
    );
    const { user } = renderRoute(<ApplicationsPage />, {
      path: '/applications',
    });
    await user.click(await screen.findByRole('combobox', { name: 'Status for Acme' }));
    await user.click(await screen.findByRole('option', { name: 'Phone interview' }));
    await waitFor(() => expect(body).toEqual({ status: 'phone_interview' }));
  });

  it('shows an empty state', async () => {
    server.use(http.get('/api/v1/applications', () => HttpResponse.json([])));
    renderRoute(<ApplicationsPage />, { path: '/applications' });
    expect(await screen.findByText(/no applications/i)).toBeInTheDocument();
  });
});
