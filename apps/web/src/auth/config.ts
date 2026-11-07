export interface AuthConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  /** Cognito's hosted-UI logout endpoint (it does not implement OIDC end_session). */
  logoutUrl: string;
}

const KEYS = [
  'VITE_COGNITO_REGION',
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
  'VITE_COGNITO_DOMAIN',
] as const;

/** Login is enabled only when the Cognito settings are baked into the build; otherwise null (open, local). */
export function readAuthConfig(
  env: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  origin: string,
): AuthConfig | null {
  const present = KEYS.filter((k) => env[k]);
  if (present.length === 0) return null;
  const missing = KEYS.filter((k) => !env[k]);
  if (missing.length > 0)
    throw new Error(`Incomplete Cognito config, missing: ${missing.join(', ')}`);

  const redirectUri = `${origin}/`;
  return {
    authority: `https://cognito-idp.${env.VITE_COGNITO_REGION}.amazonaws.com/${env.VITE_COGNITO_USER_POOL_ID}`,
    clientId: env.VITE_COGNITO_CLIENT_ID as string,
    redirectUri,
    logoutUrl: `https://${env.VITE_COGNITO_DOMAIN}/logout?client_id=${env.VITE_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(redirectUri)}`,
  };
}
