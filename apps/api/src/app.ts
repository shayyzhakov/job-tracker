import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Db } from './db/client.js';
import { healthRoutes } from './modules/health/health.routes.js';

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

  await app.register(healthRoutes, { db });

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
