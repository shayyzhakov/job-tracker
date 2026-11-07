import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { ActionsService } from './actions.service.js';

export const actionsRoutes: FastifyPluginAsyncZod<{
  service: ActionsService;
}> = async (app, { service }) => {
  app.get('/', () => service.get());
};
