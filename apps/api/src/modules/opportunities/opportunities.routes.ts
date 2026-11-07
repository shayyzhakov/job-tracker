import { OpportunityListQuerySchema } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IdParams } from '../applications/applications.routes.js';
import type { OpportunitiesService } from './opportunities.service.js';

export const opportunitiesRoutes: FastifyPluginAsyncZod<{
  service: OpportunitiesService;
}> = async (app, { service }) => {
  app.get('/', { schema: { querystring: OpportunityListQuerySchema } }, (req) =>
    service.list(req.query),
  );

  app.post('/:id/promote', { schema: { params: IdParams } }, async (req, reply) =>
    reply.code(201).send(await service.promote(req.params.id)),
  );

  app.post('/:id/dismiss', { schema: { params: IdParams } }, (req) =>
    service.dismiss(req.params.id),
  );
};
