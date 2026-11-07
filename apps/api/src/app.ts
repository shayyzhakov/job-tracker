import fastifyStatic from '@fastify/static';
import {
  ContactInputSchema,
  ContactUpdateSchema,
  InterviewInputSchema,
  InterviewUpdateSchema,
} from '@job-tracker/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createAuthHook } from './auth/auth.hook.js';
import { secretMatches } from './auth/bearer.js';
import type { TokenVerifier } from './auth/token-verifier.js';
import type { Db } from './db/dynamo.js';
import { ConflictError, NotFoundError } from './errors.js';
import { mcpRoutes } from './mcp/mcp.routes.js';
import { applicationsRoutes } from './modules/applications/applications.routes.js';
import { childRoutes } from './modules/child-routes.js';
import { companiesRoutes } from './modules/companies/companies.routes.js';
import { DynamoProgressRepository } from './modules/gamification/progress.repository.js';
import { progressRoutes } from './modules/gamification/progress.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { opportunitiesRoutes } from './modules/opportunities/opportunities.routes.js';
import { overviewRoutes } from './modules/overview/overview.routes.js';
import { scoutCriteriaRoutes } from './modules/scout-criteria/scout-criteria.routes.js';
import { type McpOAuthOptions, oauthRoutes } from './oauth/oauth.routes.js';
import { createServices } from './services.js';

export interface AppDeps {
  db: Db;
  logger?: FastifyServerOptions['logger'];
  /** When set, serve the built React app from this directory (single-image deploy). */
  webDistDir?: string;
  /** Mounts the MCP endpoint at /mcp when set. Off by default. */
  mcp?: { allowedHosts: string[]; oauth?: McpOAuthOptions } | false;
  /** When set, every /api/v1 call needs a valid bearer token. Off by default (local development). */
  auth?: { verifier: TokenVerifier };
  /** Behind CloudFront/ALB: trust X-Forwarded-* for client IP and protocol. */
  trustProxy?: boolean;
  /** When set, every request must send `x-origin-verify: <secret>`, so only CloudFront can reach a public Lambda URL. */
  originVerify?: string;
  /** Optional side layer: mounts GET /api/v1/progress (read-only). Off by default. */
  gamification?: boolean;
}

export async function buildApp({
  db,
  logger = false,
  webDistDir,
  mcp = false,
  auth,
  trustProxy = false,
  originVerify,
  gamification = false,
}: AppDeps) {
  const app = Fastify({
    logger,
    trustProxy,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (originVerify) {
    app.addHook('onRequest', async (req, reply) => {
      if (!secretMatches(req.headers['x-origin-verify'] as string | undefined, originVerify)) {
        return reply.code(403).send({ message: 'Forbidden' });
      }
    });
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ message: err.message });
    if (err instanceof ConflictError) return reply.code(409).send({ message: err.message });
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({ message: 'Validation failed', issues: err.validation });
    }
    req.log.error(err);
    return reply.code(500).send({ message: 'Internal server error' });
  });

  const services = createServices(db);

  await app.register(healthRoutes, { db });
  await app.register(
    async (api) => {
      if (auth) api.addHook('onRequest', createAuthHook(auth.verifier));
      await api.register(applicationsRoutes, {
        prefix: '/applications',
        service: services.applications,
      });
      await api.register(companiesRoutes, {
        prefix: '/companies',
        companies: services.companies,
      });
      await api.register(opportunitiesRoutes, {
        prefix: '/opportunities',
        service: services.opportunities,
      });
      await api.register(scoutCriteriaRoutes, {
        prefix: '/scout/criteria',
        repo: services.scoutCriteria,
      });
      await api.register(overviewRoutes, {
        prefix: '/overview',
        service: services.overview,
      });
      if (gamification) {
        await api.register(progressRoutes, {
          prefix: '/progress',
          source: new DynamoProgressRepository(db),
        });
      }
      await api.register(
        childRoutes({
          inputSchema: ContactInputSchema,
          updateSchema: ContactUpdateSchema,
          service: services.contacts,
        }),
        { prefix: '/applications/:applicationId/contacts' },
      );
      await api.register(
        childRoutes({
          inputSchema: InterviewInputSchema,
          updateSchema: InterviewUpdateSchema,
          service: services.interviews,
        }),
        { prefix: '/applications/:applicationId/interviews' },
      );
    },
    { prefix: '/api/v1' },
  );
  if (mcp) {
    await app.register(mcpRoutes, {
      prefix: '/mcp',
      services,
      allowedHosts: mcp.allowedHosts,
      oauth: mcp.oauth,
    });
    if (mcp.oauth) await app.register(oauthRoutes, { oauth: mcp.oauth });
  }

  if (webDistDir) {
    await app.register(fastifyStatic, { root: webDistDir });
    // SPA fallback: unknown non-API GETs return index.html so client routing works.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ message: 'Not found' });
    });
  }
  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
