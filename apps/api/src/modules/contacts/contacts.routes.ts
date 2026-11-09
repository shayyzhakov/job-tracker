import { ContactListQuerySchema } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ContactsService } from './contacts.service.js';

/** `GET /contacts` lists contacts (for reusing one on another application); `GET /contacts/:id` adds its applications. */
export const contactsRoutes: FastifyPluginAsyncZod<{
  service: ContactsService;
}> = async (app, { service }) => {
  app.get('/', { schema: { querystring: ContactListQuerySchema } }, (req) =>
    service.list(req.query.q),
  );

  app.get('/:id', { schema: { params: z.object({ id: z.uuid() }) } }, (req) =>
    service.get(req.params.id),
  );
};
