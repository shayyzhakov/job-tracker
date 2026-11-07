import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { OverviewService } from './overview.service.js';

export const overviewRoutes: FastifyPluginAsyncZod<{
  service: OverviewService;
}> = async (app, { service }) => {
  app.get('/', () => service.get());
};
