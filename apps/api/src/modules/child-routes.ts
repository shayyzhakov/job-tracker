// Shared CRUD routes for entities nested under an application (contacts, interviews).
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ChildService } from './child-service.js';

export function childRoutes<TInput, TUpdate, TDto>(opts: {
  inputSchema: z.ZodType<TInput>;
  updateSchema: z.ZodType<TUpdate>;
  service: ChildService<TInput, TUpdate, TDto>;
}): FastifyPluginAsyncZod {
  const { inputSchema, updateSchema, service } = opts;
  const AppParams = z.object({ applicationId: z.uuid() });
  const ChildParams = AppParams.extend({ id: z.uuid() });

  return async (app) => {
    app.post('/', { schema: { params: AppParams, body: inputSchema } }, async (req, reply) =>
      reply.code(201).send(await service.create(req.params.applicationId, req.body as TInput)),
    );

    app.patch('/:id', { schema: { params: ChildParams, body: updateSchema } }, (req) =>
      service.update(req.params.applicationId, req.params.id, req.body as TUpdate),
    );

    app.delete('/:id', { schema: { params: ChildParams } }, async (req, reply) => {
      await service.remove(req.params.applicationId, req.params.id);
      return reply.code(204).send();
    });
  };
}
