import type { CompanyWithCountsDto } from '@job-tracker/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { acme } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ScoutCompaniesPage } from './ScoutCompaniesPage';

const company = (o: Partial<CompanyWithCountsDto> = {}): CompanyWithCountsDto => ({
  ...acme,
  openApplications: 0,
  totalApplications: 0,
  ...o,
});

const listCompanies = (rows: CompanyWithCountsDto[]) =>
  server.use(http.get('/api/v1/companies/with-counts', () => HttpResponse.json(rows)));

const render = () => renderRoute(<ScoutCompaniesPage />, { path: '/scout/companies' });
const bucket = (name: string) => screen.getByRole('region', { name: `${name} bucket` });

describe('ScoutCompaniesPage', () => {
  it('groups companies into their priority buckets', async () => {
    listCompanies([
      company({ id: 'c1', name: 'Acme' }),
      company({ id: 'c2', name: 'Wix', priority: 'top' }),
      company({ id: 'c3', name: 'Evil Corp', priority: 'blacklist' }),
    ]);
    render();

    expect(await within(await findBucket('Top target')).findByText('Wix')).toBeInTheDocument();
    expect(within(bucket('Moderate')).getByText('Acme')).toBeInTheDocument();
    expect(within(bucket('Blacklist')).getByText('Evil Corp')).toBeInTheDocument();
    expect(within(bucket('High')).getByText('Empty')).toBeInTheDocument();
  });

  it('moves a company to another bucket', async () => {
    listCompanies([company()]);
    let body: unknown;
    server.use(
      http.patch('/api/v1/companies/c1', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...company(), priority: 'high' });
      }),
    );
    const { user } = render();

    await user.click(await screen.findByRole('button', { name: 'Move Acme' }));
    await user.click(await screen.findByRole('menuitem', { name: 'High' }));

    await waitFor(() => expect(body).toEqual({ priority: 'high' }));
  });

  it('moves a company by dragging its card onto another bucket', async () => {
    listCompanies([company()]);
    let body: unknown;
    server.use(
      http.patch('/api/v1/companies/c1', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...company(), priority: 'blacklist' });
      }),
    );
    render();

    fireEvent.dragStart(await screen.findByTestId('company-c1'));
    fireEvent.dragOver(screen.getByTestId('bucket-blacklist'));
    fireEvent.drop(screen.getByTestId('bucket-blacklist'));

    await waitFor(() => expect(body).toEqual({ priority: 'blacklist' }));
  });

  it('ignores a drop on the bucket the company is already in', async () => {
    listCompanies([company()]);
    let called = false;
    server.use(
      http.patch('/api/v1/companies/c1', () => {
        called = true;
        return HttpResponse.json(company());
      }),
    );
    render();

    fireEvent.dragStart(await screen.findByTestId('company-c1'));
    fireEvent.drop(screen.getByTestId('bucket-moderate'));

    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });

  it('filters companies by name', async () => {
    listCompanies([company(), company({ id: 'c2', name: 'Wix' })]);
    const { user } = render();
    await screen.findByText('Wix');
    await user.type(screen.getByRole('textbox', { name: 'Search companies' }), 'wi');
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.getByText('Wix')).toBeInTheDocument();
  });

  it('points to the Companies page when there are none', async () => {
    listCompanies([]);
    render();
    expect(await screen.findByRole('link', { name: 'Companies page' })).toHaveAttribute(
      'href',
      '/companies',
    );
  });
});

const findBucket = (name: string) => screen.findByRole('region', { name: `${name} bucket` });
