import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  sub: string;
  /** OAuth scopes granted to the token (the `scope` claim, split on spaces). */
  scopes: string[];
}

/** Verifies a bearer token; rejects when it is invalid or expired. */
export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

/**
 * Verifies Cognito access tokens (signature via the pool's JWKS, issuer, expiry).
 * `clientId` pins the app client (REST API: the web app); `null` accepts any client of the pool,
 * which MCP needs because every MCP client registers its own app client (see oauth/).
 */
export function createCognitoVerifier(opts: {
  userPoolId: string;
  clientId: string | null;
}): TokenVerifier {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: opts.userPoolId,
    clientId: opts.clientId,
    tokenUse: 'access',
  });
  return {
    async verify(token) {
      const payload = await verifier.verify(token);
      return { sub: payload.sub, scopes: (payload.scope ?? '').split(' ').filter(Boolean) };
    },
  };
}
