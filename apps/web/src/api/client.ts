import { getAccessToken, handleUnauthorized } from '../auth/token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Same-origin in production; Vite proxies /api in dev. Override for a separate API host (e.g. CloudFront + ALB). */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, payload?.message ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
