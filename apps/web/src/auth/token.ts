let provider: (() => string | undefined) | undefined;
let onUnauthorized: (() => Promise<boolean>) | undefined;

/**
 * Registered by AuthGate so the fetch client can attach the access token without React. `onUnauthorized` runs on a
 * 401 and resolves true when the session was renewed and the request is worth retrying once; otherwise it has sent
 * the user to sign in (or the session cannot be renewed right now) and the request fails.
 */
export function configureAuth(opts: {
  getToken: () => string | undefined;
  onUnauthorized: () => Promise<boolean>;
}) {
  provider = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export const getAccessToken = () => provider?.();
export const handleUnauthorized = async () => (await onUnauthorized?.()) ?? false;
