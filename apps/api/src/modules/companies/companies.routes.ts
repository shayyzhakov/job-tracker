import { CompanyInputSchema, CompanyUpdateSchema } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CompaniesService } from './companies.service.js';

const idParams = z.object({ id: z.uuid() });

export const companiesRoutes: FastifyPluginAsyncZod<{
  companies: CompaniesService;
}> = async (app, { companies }) => {
  // Plain matches by name (no counts): used by the application form's company picker.
  app.get('/', { schema: { querystring: z.object({ q: z.string().trim().optional() }) } }, (req) =>
    companies.search(req.query.q || undefined),
  );

  // The Companies page: every company with its application counts.
  app.get(
    '/with-counts',
    { schema: { querystring: z.object({ q: z.string().trim().optional() }) } },
    (req) => companies.list(req.query.q || undefined),
  );

  app.post('/', { schema: { body: CompanyInputSchema } }, async (req, reply) => {
    reply.code(201);
    return companies.create(req.body);
  });

  app.get('/:id', { schema: { params: idParams } }, (req) => companies.get(req.params.id));

  app.patch('/:id', { schema: { params: idParams, body: CompanyUpdateSchema } }, (req) =>
    companies.update(req.params.id, req.body),
  );

  app.delete('/:id', { schema: { params: idParams } }, async (req, reply) => {
    await companies.remove(req.params.id);
    return reply.code(204).send();
  });
};
