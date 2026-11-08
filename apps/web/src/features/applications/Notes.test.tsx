import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { applicationDetail } from '../../../test/fixtures';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const interview = (id: string, type: 'phone' | 'technical', scheduledAt: string) => ({
  id,
  applicationId: 'a1',
  type,
  scheduledAt,
  durationMinutes: null,
  location: null,
  timeUnknown: false,
  debriefedAt: null,
});
const note = (id: string, interviewId: string, text: string, createdAt: string) => ({
  id,
  applicationId: 'a1',
  interviewId,
  text,
  createdAt,
  updatedAt: createdAt,
});

const withNotes = () =>
  server.use(
    http.get('/api/v1/applications/:id', () =>
      HttpResponse.json(
        applicationDetail({
          interviews: [
            interview('i1', 'phone', '2020-01-01T10:00:00.000Z'),
            interview('i2', 'technical', '2999-01-01T10:00:00.000Z'),
          ],
          interviewNotes: [
            note('n2', 'i1', 'Second phone note', '2020-01-02T10:00:00.000Z'),
            note('n1', 'i1', 'First phone note', '2020-01-01T11:00:00.000Z'),
            note('n3', 'i2', 'Prep: ask about the team', '2026-11-01T10:00:00.000Z'),
          ],
        }),
      ),
    ),
  );

const renderDetail = () =>
  renderRoute(<ApplicationDetailPage />, {
    path: '/applications/a1',
    route: '/applications/:id',
  });

describe('interview notes', () => {
  it('lists every note in the Notes tab grouped by interview, newest interview first', async () => {
    withNotes();
    const { user } = renderDetail();
    await user.click(await screen.findByRole('tab', { name: /notes \(3\)/i }));
    const groups = await screen.findAllByTestId('notes-group');
    expect(groups).toHaveLength(2);
    expect(within(groups[0] as HTMLElement).getByText('Prep: ask about the team')).toBeVisible();
    expect(within(groups[0] as HTMLElement).getByText('Technical')).toBeVisible();
    const phone = within(groups[1] as HTMLElement);
    expect(phone.getAllByText(/phone note/).map((e) => e.textContent)).toEqual([
      'Second phone note',
      'First phone note',
    ]);
  });

  it('shows an empty state when there are no notes', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('tab', { name: /^notes$/i }));
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
  });

  it('shows a note count on the interview card and adds a note to a future interview', async () => {
    withNotes();
    let body: Record<string, unknown> | undefined;
    let url = '';
    server.use(
      http.post('/api/v1/applications/:id/interviews/:interviewId/notes', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        url = new URL(request.url).pathname;
        return HttpResponse.json({ id: 'n9' }, { status: 201 });
      }),
    );
    const { user } = renderDetail();
    expect(
      await screen.findByRole('button', { name: /notes for phone interview/i }),
    ).toHaveTextContent('Notes (2)');
    await user.click(screen.getByRole('button', { name: /notes for technical interview/i }));
    await user.click(await screen.findByRole('button', { name: /^add note$/i }));
    const save = screen.getByRole('button', { name: /^add note$/i });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Note'), 'line one{enter}line two');
    await user.click(save);
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ text: 'line one\nline two' });
    expect(url).toBe('/api/v1/applications/a1/interviews/i2/notes');
  });

  it('edits a note and asks for confirmation before deleting', async () => {
    withNotes();
    let patched: Record<string, unknown> | undefined;
    let deleted = false;
    server.use(
      http.patch('/api/v1/applications/:id/interviews/:iid/notes/:nid', async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      }),
      http.delete('/api/v1/applications/:id/interviews/:iid/notes/:nid', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('tab', { name: /notes \(3\)/i }));
    const group = within((await screen.findAllByTestId('notes-group'))[0] as HTMLElement);

    await user.click(group.getByRole('button', { name: /edit note/i }));
    const box = screen.getByLabelText('Note');
    await user.clear(box);
    await user.type(box, 'Updated prep');
    await user.click(screen.getByRole('button', { name: /save note/i }));
    await waitFor(() => expect(patched).toEqual({ text: 'Updated prep' }));

    await user.click(group.getByRole('button', { name: /delete note/i }));
    expect(deleted).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: /delete note/i });
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('no longer has a single-line notes field in the interview form', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: /schedule interview/i }));
    expect(screen.queryByLabelText(/interview notes/i)).not.toBeInTheDocument();
  });
});
