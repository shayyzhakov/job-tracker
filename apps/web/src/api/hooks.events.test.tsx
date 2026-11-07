/**
 * Contract between core and optional layers: every successful write announces a domain event,
 * a failed write announces nothing. Optional layers rely on this; changing it breaks them.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applicationDetail } from '../../test/fixtures';
import { server } from '../../test/server';
import { type AppEvent, onAppEvent } from '../lib/app-events';
import {
  useChangeStatus,
  useContactMutations,
  useCreateApplication,
  useDeleteApplication,
  useInterviewMutations,
  usePromoteOpportunity,
} from './hooks';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

let events: AppEvent[];
let off: () => void;
beforeEach(() => {
  events = [];
  off = onAppEvent((e) => events.push(e));
});
afterEach(() => off());

describe('core mutations announce domain events', () => {
  it('application.created', async () => {
    server.use(
      http.post('/api/v1/applications', () => HttpResponse.json(applicationDetail({ id: 'new' }))),
    );
    const { result } = renderHook(() => useCreateApplication(), { wrapper });
    await act(() => result.current.mutateAsync({} as never));
    expect(events).toEqual([{ type: 'application.created', applicationId: 'new' }]);
  });

  it('status.changed carries the new status', async () => {
    server.use(
      http.patch('/api/v1/applications/a1/status', () => HttpResponse.json(applicationDetail())),
    );
    const { result } = renderHook(() => useChangeStatus(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 'a1', status: 'offer' }));
    expect(events).toEqual([{ type: 'status.changed', applicationId: 'a1', status: 'offer' }]);
  });

  it('application.deleted', async () => {
    server.use(
      http.delete('/api/v1/applications/a1', () => new HttpResponse(null, { status: 204 })),
    );
    const { result } = renderHook(() => useDeleteApplication(), { wrapper });
    await act(() => result.current.mutateAsync('a1'));
    expect(events).toEqual([{ type: 'application.deleted', applicationId: 'a1' }]);
  });

  it('contact.created and interview.created', async () => {
    server.use(
      http.post('/api/v1/applications/a1/contacts', () => HttpResponse.json({ id: 'c' })),
      http.post('/api/v1/applications/a1/interviews', () => HttpResponse.json({ id: 'i' })),
    );
    const contacts = renderHook(() => useContactMutations('a1'), { wrapper });
    const interviews = renderHook(() => useInterviewMutations('a1'), { wrapper });
    await act(() => contacts.result.current.create.mutateAsync({} as never));
    await act(() => interviews.result.current.create.mutateAsync({} as never));
    expect(events).toEqual([
      { type: 'contact.created', applicationId: 'a1' },
      { type: 'interview.created', applicationId: 'a1' },
    ]);
  });

  it('promoting a suggestion creates an application', async () => {
    server.use(
      http.post('/api/v1/opportunities/o1/promote', () =>
        HttpResponse.json(applicationDetail({ id: 'p' })),
      ),
    );
    const { result } = renderHook(() => usePromoteOpportunity(), { wrapper });
    await act(() => result.current.mutateAsync('o1'));
    expect(events).toEqual([{ type: 'application.created', applicationId: 'p' }]);
  });

  it('announces nothing when the write fails', async () => {
    server.use(
      http.patch('/api/v1/applications/a1/status', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useChangeStatus(), { wrapper });
    await act(async () => {
      result.current.mutate({ id: 'a1', status: 'offer' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(events).toEqual([]);
  });

  it('a throwing subscriber never breaks the write', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const offBad = onAppEvent(() => {
      throw new Error('subscriber bug');
    });
    server.use(
      http.patch('/api/v1/applications/a1/status', () => HttpResponse.json(applicationDetail())),
    );
    const { result } = renderHook(() => useChangeStatus(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 'a1', status: 'offer' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    offBad();
    err.mockRestore();
  });
});
