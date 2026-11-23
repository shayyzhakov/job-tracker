import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/server';
import { configureAuth } from '../auth/token';
import { api } from './client';

afterEach(() => configureAuth({ getToken: () => undefined, onUnauthorized: async () => false }));

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
    configureAuth({ getToken: () => 'tok-123', onUnauthorized: async () => false });
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

  it('renews the session on a 401 and retries once with the new token', async () => {
    let token = 'expired';
    const onUnauthorized = vi.fn(async () => {
      token = 'fresh';
      return true;
    });
    configureAuth({ getToken: () => token, onUnauthorized });
    const seen: (string | null)[] = [];
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        const auth = request.headers.get('authorization');
        seen.push(auth);
        return auth === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ message: 'nope' }, { status: 401 });
      }),
    );
    await expect(api('/ping')).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['Bearer expired', 'Bearer fresh']);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('fails without retrying when the session cannot be renewed', async () => {
    const onUnauthorized = vi.fn(async () => false);
    configureAuth({ getToken: () => 'expired', onUnauthorized });
    let calls = 0;
    server.use(
      http.get('*/api/v1/ping', () => {
        calls++;
        return HttpResponse.json({ message: 'nope' }, { status: 401 });
      }),
    );
    await expect(api('/ping')).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(1);
  });

  it('does not loop when the API rejects even a renewed token', async () => {
    const onUnauthorized = vi.fn(async () => true);
    configureAuth({ getToken: () => 'tok', onUnauthorized });
    server.use(
      http.get('*/api/v1/ping', () => HttpResponse.json({ message: 'nope' }, { status: 401 })),
    );
    await expect(api('/ping')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
