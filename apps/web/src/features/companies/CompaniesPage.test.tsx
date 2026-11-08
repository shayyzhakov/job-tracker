import type { CompanyWithCountsDto } from '@job-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { acme } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { CompaniesPage } from './CompaniesPage';

const company = (o: Partial<CompanyWithCountsDto> = {}): CompanyWithCountsDto => ({
  ...acme,
  activeApplications: 2,
  totalApplications: 3,
  ...o,
});

const listCompanies = (rows: CompanyWithCountsDto[]) =>
  server.use(http.get('/api/v1/companies/with-counts', () => HttpResponse.json(rows)));

const rowOf = async (name: string) => {
  const row = (await screen.findByText(name)).closest('tr');
  if (!row) throw new Error('row not found');
  return row;
};

describe('CompaniesPage', () => {
  it('shows name, size, type and active / total applications', async () => {
    listCompanies([company(), company({ id: 'c2', name: 'Wix', size: null, isPublic: true })]);
    renderRoute(<CompaniesPage />, { path: '/companies' });

    const acmeRow = await rowOf('Acme');
    expect(within(acmeRow).getByText('Scale-up')).toBeInTheDocument();
    expect(within(acmeRow).getByText('Private')).toBeInTheDocument();
    expect(within(acmeRow).getByRole('link', { name: /2 active of 3/ })).toHaveTextContent('2 / 3');
    expect(within(acmeRow).getByRole('link', { name: /2 active of 3/ })).toHaveAttribute(
      'href',
      '/applications?q=Acme&scope=all',
    );
    expect(within(await rowOf('Wix')).getByText('Public')).toBeInTheDocument();
  });

  it('shows 0 / 0 for a company without applications and allows deleting it', async () => {
    listCompanies([company({ activeApplications: 0, totalApplications: 0 })]);
    let deleted = false;
    server.use(
      http.delete('/api/v1/companies/c1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRoute(<CompaniesPage />, { path: '/companies' });

    expect(within(await rowOf('Acme')).getByText('0 / 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Acme' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('does not delete a company that has applications', async () => {
    listCompanies([company({ activeApplications: 0, totalApplications: 1 })]);
    const { user } = renderRoute(<CompaniesPage />, { path: '/companies' });

    const button = await screen.findByRole('button', { name: 'Delete Acme' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('adds a company with no application', async () => {
    listCompanies([]);
    let body: unknown;
    server.use(
      http.post('/api/v1/companies', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(company({ id: 'c9', name: 'Monday' }), { status: 201 });
      }),
    );
    const { user } = renderRoute(<CompaniesPage />, { path: '/companies' });

    await user.click(await screen.findByRole('button', { name: 'Add company' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Monday');
    await user.click(within(dialog).getByRole('radio', { name: 'Public' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add company' }));

    await waitFor(() => expect(body).toMatchObject({ name: 'Monday', isPublic: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits a company and shows a name conflict from the server', async () => {
    listCompanies([company()]);
    server.use(
      http.patch('/api/v1/companies/c1', () =>
        HttpResponse.json({ message: 'Company "Wix" already exists' }, { status: 409 }),
      ),
    );
    const { user } = renderRoute(<CompaniesPage />, { path: '/companies' });

    await user.click(await screen.findByRole('button', { name: 'Edit Acme' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/all 3 applications/)).toBeInTheDocument();
    const name = within(dialog).getByLabelText(/Name/);
    await user.clear(name);
    await user.type(name, 'Wix');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already exists');
  });

  it('filters to companies with or without applications', async () => {
    listCompanies([
      company(),
      company({ id: 'c2', name: 'Wix', activeApplications: 0, totalApplications: 0 }),
    ]);
    const { user } = renderRoute(<CompaniesPage />, { path: '/companies' });
    await screen.findByText('Acme');

    await user.click(screen.getByRole('radio', { name: 'No applications' }));
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.getByText('Wix')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'With applications' }));
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('Wix')).not.toBeInTheDocument();
  });
});
