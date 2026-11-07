import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { application } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { PipelinePage } from './PipelinePage';

beforeEach(() => localStorage.clear());

describe('PipelinePage', () => {
  it('groups statuses into three columns and shows the exact status as a badge', async () => {
    server.use(
      http.get('/api/v1/applications', () =>
        HttpResponse.json([
          application({ id: 'a', status: 'to_apply' }),
          application({ id: 'b', status: 'technical_interview' }),
          application({ id: 'c', status: 'rejected' }),
        ]),
      ),
    );
    renderRoute(<PipelinePage />);
    const todo = await screen.findByTestId('col-todo');
    expect(within(todo).getByTestId('badge-a')).toHaveTextContent('To apply');
    expect(within(screen.getByTestId('col-progress')).getByTestId('badge-b')).toHaveTextContent(
      'Technical interview',
    );
    expect(within(screen.getByTestId('col-done')).getByTestId('badge-c')).toHaveTextContent(
      'Rejected',
    );
    expect(document.querySelectorAll('[data-testid^="col-"]')).toHaveLength(3);
  });

  it('changes the exact status from the badge menu', async () => {
    let body: unknown;
    server.use(
      http.get('/api/v1/applications', () =>
        HttpResponse.json([application({ id: 'a', status: 'applied' })]),
      ),
      http.patch('/api/v1/applications/a/status', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
    );
    const { user } = renderRoute(<PipelinePage />);
    await user.click(await screen.findByTestId('badge-a'));
    await user.click(await screen.findByRole('menuitem', { name: 'Offer' }));
    expect(body).toEqual({ status: 'offer' });
  });
});
