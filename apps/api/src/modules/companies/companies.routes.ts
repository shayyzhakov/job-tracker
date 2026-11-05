import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CompaniesRepository } from './companies.repository.js';

export const companiesRoutes: FastifyPluginAsyncZod<{ companies: CompaniesRepository }> = async (
  app,
  { companies },
) => {
  app.get('/', { schema: { querystring: z.object({ q: z.string().trim().optional() }) } }, (req) =>
    companies.search(req.query.q || undefined),
  );
};
