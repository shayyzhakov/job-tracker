import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { buildOverview } from './build-overview.js';
import type { DrizzleOverviewRepository } from './overview.repository.js';

export const overviewRoutes: FastifyPluginAsyncZod<{
  repo: DrizzleOverviewRepository;
  now?: () => Date;
}> = async (app, { repo, now = () => new Date() }) => {
  app.get('/', async () => {
    const at = now();
    return buildOverview(await repo.load(at), at);
  });
};
