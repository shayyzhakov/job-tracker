import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TokenVerifier } from '../auth/token-verifier.js';
import { type ClientRegistry, InvalidClientMetadataError } from './client-registry.js';
import { isAllowedRedirect } from './redirect-allowlist.js';

/** Everything the MCP endpoint needs to speak OAuth: Cognito issues the tokens, this app adds discovery + registration. */
export interface McpOAuthOptions {
  verifier: TokenVerifier;
  /** Public origin of the app, e.g. https://d111.cloudfront.net (no trailing slash). */
  publicUrl: string;
  /** Scope that grants access to /mcp, e.g. `jobtracker/mcp` (a custom scope of the Cognito resource server). */
  scope: string;
  /** Hostname of the Cognito hosted UI domain. */
  cognitoDomain: string;
  registry: ClientRegistry;
  redirectAllowlist: string[];
}

/** Dynamically registered clients kept at once; the oldest are deleted to make room (Cognito allows ~1000 per pool). */
export const MAX_REGISTERED_CLIENTS = 50;
const MAX_REGISTRATIONS_PER_MINUTE = 10;

/** `WWW-Authenticate` value that points MCP clients at the protected resource metadata (RFC 9728). */
export function authChallenge(
  oauth: McpOAuthOptions,
  error?: 'invalid_token' | 'insufficient_scope',
) {
  const params = [
    `resource_metadata="${oauth.publicUrl}/.well-known/oauth-protected-resource/mcp"`,
    `scope="${oauth.scope}"`,
    ...(error ? [`error="${error}"`] : []),
  ];
  return `Bearer ${params.join(', ')}`;
}

const RegistrationSchema = z.object({
  redirect_uris: z.array(z.string().max(2048)).min(1).max(5),
  client_name: z.string().max(100).optional(),
  // Requested auth method, grant and response types are accepted but ignored: RFC 7591 lets the server decide, and
  // the response below says what the client actually got (a public client, code + refresh token). Clients such as
  // ChatGPT ask for client_secret_post and expect to be told otherwise rather than rejected.
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

/** Discovery documents (RFC 9728, RFC 8414) and Dynamic Client Registration (RFC 7591). Mounted at the app root. */
export const oauthRoutes: FastifyPluginAsync<{ oauth: McpOAuthOptions }> = async (
  app,
  { oauth },
) => {
  const { publicUrl, scope, cognitoDomain } = oauth;

  const resourceMetadata = {
    resource: `${publicUrl}/mcp`,
    authorization_servers: [publicUrl],
    scopes_supported: [scope],
    bearer_methods_supported: ['header'],
  };
  const authorizationServerMetadata = {
    issuer: publicUrl,
    authorization_endpoint: `https://${cognitoDomain}/oauth2/authorize`,
    token_endpoint: `https://${cognitoDomain}/oauth2/token`,
    revocation_endpoint: `https://${cognitoDomain}/oauth2/revoke`,
    registration_endpoint: `${publicUrl}/oauth/register`,
    scopes_supported: ['openid', scope],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };

  const publicDoc = (doc: object) => async (_req: unknown, reply: import('fastify').FastifyReply) =>
    reply.header('cache-control', 'public, max-age=300').send(doc);
  app.get('/.well-known/oauth-protected-resource', publicDoc(resourceMetadata));
  app.get('/.well-known/oauth-protected-resource/mcp', publicDoc(resourceMetadata));
  app.get('/.well-known/oauth-authorization-server', publicDoc(authorizationServerMetadata));
  app.get('/.well-known/openid-configuration', publicDoc(authorizationServerMetadata));

  // Per-instance limiter: crude (Lambda instances do not share it) but the client cap below bounds the damage.
  let windowStart = 0;
  let count = 0;
  const rateLimited = () => {
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      count = 0;
    }
    return ++count > MAX_REGISTRATIONS_PER_MINUTE;
  };

  const invalid = (
    error: 'invalid_redirect_uri' | 'invalid_client_metadata',
    description: string,
  ) => ({
    error,
    error_description: description,
  });

  app.post('/oauth/register', async (req, reply) => {
    if (rateLimited()) {
      return reply.code(429).header('retry-after', '60').send({ error: 'temporarily_unavailable' });
    }
    const parsed = RegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn(
        { issues: parsed.error.issues.map((i) => i.path.join('.')) },
        'registration rejected',
      );
      return reply
        .code(400)
        .send(invalid('invalid_client_metadata', 'Malformed registration request'));
    }
    const { redirect_uris, client_name } = parsed.data;
    const rejected = redirect_uris.find((u) => !isAllowedRedirect(u, oauth.redirectAllowlist));
    if (rejected) {
      req.log.warn({ rejected }, 'registration rejected: redirect URI not allowed');
      return reply
        .code(400)
        .send(invalid('invalid_redirect_uri', `Redirect URI not allowed: ${rejected}`));
    }

    const existing = await oauth.registry.list();
    const excess = existing.length - (MAX_REGISTERED_CLIENTS - 1);
    for (const old of excess > 0 ? existing.slice(0, excess) : []) {
      await oauth.registry.remove(old.clientId);
    }

    let clientId: string;
    try {
      ({ clientId } = await oauth.registry.create({
        displayName: client_name ?? 'client',
        redirectUris: redirect_uris,
      }));
    } catch (err) {
      if (err instanceof InvalidClientMetadataError) {
        return reply.code(400).send(invalid('invalid_redirect_uri', err.message));
      }
      throw err;
    }
    req.log.info({ clientId, client_name }, 'registered OAuth client');

    return reply
      .code(201)
      .header('cache-control', 'no-store')
      .send({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name,
        redirect_uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: `openid ${scope}`,
      });
  });
};
