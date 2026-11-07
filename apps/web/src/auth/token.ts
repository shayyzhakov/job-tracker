let provider: (() => string | undefined) | undefined;
let onUnauthorized: (() => void) | undefined;

/** Registered by AuthGate so the fetch client can attach the access token without React. */
export function configureAuth(opts: {
  getToken: () => string | undefined;
  onUnauthorized: () => void;
}) {
  provider = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export const getAccessToken = () => provider?.();
export const handleUnauthorized = () => onUnauthorized?.();
