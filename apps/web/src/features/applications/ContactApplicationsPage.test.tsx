import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ContactApplicationsPage } from './ContactApplicationsPage';

describe('ContactApplicationsPage', () => {
  it('lists every application the contact is attached to', async () => {
    server.use(
      http.get('/api/v1/contacts/:id', () =>
        HttpResponse.json({
          id: 'ct1',
          applicationCount: 2,
          name: 'Dana Levi',
          role: 'Headhunter',
          email: 'dana@agency.com',
          phone: null,
          linkedinUrl: null,
          notes: null,
          applications: [
            {
              id: 'a1',
              roleName: 'Backend Engineer',
              status: 'applied',
              companyName: 'Acme',
            },
            {
              id: 'a2',
              roleName: 'Staff Engineer',
              status: 'rejected',
              companyName: 'Globex',
            },
          ],
        }),
      ),
    );
    renderRoute(<ContactApplicationsPage />, {
      path: '/contacts/ct1',
      route: '/contacts/:id',
    });
    expect(await screen.findByRole('heading', { name: 'Dana Levi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /backend engineer · acme/i })).toHaveAttribute(
      'href',
      '/applications/a1',
    );
    expect(screen.getByRole('link', { name: /staff engineer · globex/i })).toBeInTheDocument();
  });
});

describe('contact on several applications', () => {
  it('links to the contact page from the application', async () => {
    const { ApplicationDetailPage } = await import('./ApplicationDetailPage');
    server.use(
      http.get('/api/v1/applications/:id', () =>
        HttpResponse.json(
          applicationDetail({
            contacts: [
              {
                id: 'ct1',
                applicationCount: 3,
                name: 'Dana Levi',
                role: 'Headhunter',
                email: null,
                phone: null,
                linkedinUrl: null,
                notes: null,
              },
            ],
          }),
        ),
      ),
    );
    renderRoute(<ApplicationDetailPage />, {
      path: '/applications/a1',
      route: '/applications/:id',
    });
    expect(await screen.findByRole('link', { name: 'On 3 applications' })).toHaveAttribute(
      'href',
      '/contacts/ct1',
    );
  });
});
