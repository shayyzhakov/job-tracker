import { ScoutCriteriaSchema } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { ScoutCriteriaRepository } from './scout-criteria.repository.js';

export const scoutCriteriaRoutes: FastifyPluginAsyncZod<{
  repo: ScoutCriteriaRepository;
}> = async (app, { repo }) => {
  app.get('/', () => repo.get());

  // Full replacement: omitted fields go back to their defaults.
  app.put('/', { schema: { body: ScoutCriteriaSchema } }, (req) => repo.save(req.body));
};
