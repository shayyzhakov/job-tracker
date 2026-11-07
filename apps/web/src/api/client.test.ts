import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/server';
import { configureAuth } from '../auth/token';
import { api } from './client';

afterEach(() => configureAuth({ getToken: () => undefined, onUnauthorized: () => {} }));

describe('api client auth', () => {
  it('sends no Authorization header when login is not configured', async () => {
    let header: string | null = 'unset';
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        header = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await api('/ping');
    expect(header).toBeNull();
  });

  it('attaches the access token as a bearer token', async () => {
    configureAuth({ getToken: () => 'tok-123', onUnauthorized: () => {} });
    let header: string | null = null;
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        header = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await api('/ping');
    expect(header).toBe('Bearer tok-123');
  });

  it('asks to sign in again when the API answers 401', async () => {
    const onUnauthorized = vi.fn();
    configureAuth({ getToken: () => 'expired', onUnauthorized });
    server.use(
      http.get('*/api/v1/ping', () => HttpResponse.json({ message: 'nope' }, { status: 401 })),
    );
    await expect(api('/ping')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
