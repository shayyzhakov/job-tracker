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
import type { Db } from './db/client.js';
import { NotFoundError } from './errors.js';
import { DrizzleApplicationsRepository } from './modules/applications/applications.repository.js';
import { applicationsRoutes } from './modules/applications/applications.routes.js';
import { ApplicationsService } from './modules/applications/applications.service.js';
import { childRoutes } from './modules/child-routes.js';
import { DrizzleCompaniesRepository } from './modules/companies/companies.repository.js';
import { companiesRoutes } from './modules/companies/companies.routes.js';
import { DrizzleContactsRepository } from './modules/contacts/contacts.repository.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { DrizzleInterviewsRepository } from './modules/interviews/interviews.repository.js';
import { DrizzleOverviewRepository } from './modules/overview/overview.repository.js';
import { overviewRoutes } from './modules/overview/overview.routes.js';

export interface AppDeps {
  db: Db;
  logger?: FastifyServerOptions['logger'];
  /** When set, serve the built React app from this directory (single-image deploy). */
  webDistDir?: string;
}

export async function buildApp({ db, logger = false, webDistDir }: AppDeps) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ message: err.message });
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({ message: 'Validation failed', issues: err.validation });
    }
    req.log.error(err);
    return reply.code(500).send({ message: 'Internal server error' });
  });

  // Composition root: wire repositories -> services -> routes.
  const companies = new DrizzleCompaniesRepository(db);
  const applications = new DrizzleApplicationsRepository(db);
  const applicationsService = new ApplicationsService({ applications, companies });

  await app.register(healthRoutes, { db });
  await app.register(
    async (api) => {
      await api.register(applicationsRoutes, {
        prefix: '/applications',
        service: applicationsService,
      });
      await api.register(companiesRoutes, { prefix: '/companies', companies });
      await api.register(overviewRoutes, {
        prefix: '/overview',
        repo: new DrizzleOverviewRepository(db),
      });
      await api.register(
        childRoutes({
          entity: 'Contact',
          inputSchema: ContactInputSchema,
          updateSchema: ContactUpdateSchema,
          repo: new DrizzleContactsRepository(db),
          applications,
        }),
        { prefix: '/applications/:applicationId/contacts' },
      );
      await api.register(
        childRoutes({
          entity: 'Interview',
          inputSchema: InterviewInputSchema,
          updateSchema: InterviewUpdateSchema,
          repo: new DrizzleInterviewsRepository(db),
          applications,
        }),
        { prefix: '/applications/:applicationId/interviews' },
      );
    },
    { prefix: '/api/v1' },
  );

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
