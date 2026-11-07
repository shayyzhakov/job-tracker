import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { parseBearer } from '../auth/bearer.js';
import { authChallenge, type McpOAuthOptions } from '../oauth/oauth.routes.js';
import type { Services } from '../services.js';
import { createMcpServer } from './server.js';

export interface McpRoutesOptions {
  services: Services;
  /** Hostnames allowed in the Host header (local-only by default). */
  allowedHosts: string[];
  /** When set, requests must carry an OAuth access token with the MCP scope. */
  oauth?: McpOAuthOptions;
}

/** Hostname from a Host header, without the port ("localhost:3000" → "localhost", "[::1]:3000" → "[::1]"). */
const hostname = (host = '') => host.toLowerCase().replace(/:\d+$/, '');

/** Stateless Streamable HTTP endpoint: each POST gets a fresh server and transport. */
export const mcpRoutes: FastifyPluginAsync<McpRoutesOptions> = async (
  app,
  { services, allowedHosts, oauth },
) => {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
  // "*" is for cloud deployments where the public hostname is not known up front; only safe with OAuth.
  const anyHost = allowed.has('*');
  if (anyHost && !oauth) {
    throw new Error('MCP_ALLOWED_HOSTS=* requires OAuth (Cognito) to be configured');
  }

  // Blocks remote callers and DNS-rebinding attacks from web pages.
  app.addHook('onRequest', async (req, reply) => {
    if (!anyHost && !allowed.has(hostname(req.headers.host))) {
      return reply.code(403).send({ message: 'Host not allowed' });
    }
    if (!oauth) return;
    const token = parseBearer(req.headers.authorization);
    if (!token) {
      return reply
        .code(401)
        .header('www-authenticate', authChallenge(oauth))
        .send({ message: 'Authentication required' });
    }
    try {
      const user = await oauth.verifier.verify(token);
      if (!user.scopes.includes(oauth.scope)) {
        return reply
          .code(403)
          .header('www-authenticate', authChallenge(oauth, 'insufficient_scope'))
          .send({ message: 'Token lacks the MCP scope' });
      }
    } catch (err) {
      req.log.info({ err: String(err) }, 'mcp token rejected');
      return reply
        .code(401)
        .header('www-authenticate', authChallenge(oauth, 'invalid_token'))
        .send({ message: 'Invalid or expired token' });
    }
  });

  app.post('/', async (req, reply) => {
    const server = createMcpServer(services, req.log);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  const methodNotAllowed = async (_req: unknown, reply: FastifyReply) =>
    reply.code(405).header('allow', 'POST').send({ message: 'Method not allowed' });
  app.get('/', methodNotAllowed);
  app.delete('/', methodNotAllowed);
};
