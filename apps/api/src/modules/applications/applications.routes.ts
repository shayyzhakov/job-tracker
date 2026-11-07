import {
  ApplicationCreateSchema,
  ApplicationListQuerySchema,
  ApplicationUpdateSchema,
  HandOverSchema,
  SnoozeSchema,
  StatusChangeSchema,
} from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ApplicationsService } from './applications.service.js';

export const IdParams = z.object({ id: z.uuid() });

export const applicationsRoutes: FastifyPluginAsyncZod<{
  service: ApplicationsService;
}> = async (app, { service }) => {
  app.get('/', { schema: { querystring: ApplicationListQuerySchema } }, (req) =>
    service.list(req.query),
  );

  app.post('/', { schema: { body: ApplicationCreateSchema } }, async (req, reply) =>
    reply.code(201).send(await service.create(req.body)),
  );

  app.get('/:id', { schema: { params: IdParams } }, (req) => service.get(req.params.id));

  app.patch('/:id', { schema: { params: IdParams, body: ApplicationUpdateSchema } }, (req) =>
    service.update(req.params.id, req.body),
  );

  app.patch('/:id/status', { schema: { params: IdParams, body: StatusChangeSchema } }, (req) =>
    service.changeStatus(req.params.id, req.body.status, req.body.interviewAt, {
      replyBy: req.body.replyBy,
      dueAt: req.body.dueAt,
    }),
  );

  app.post('/:id/snooze', { schema: { params: IdParams, body: SnoozeSchema } }, (req) =>
    service.snooze(req.params.id, req.body.until),
  );

  app.post('/:id/hand-over', { schema: { params: IdParams, body: HandOverSchema } }, (req) =>
    service.handOver(req.params.id, req.body.reason),
  );

  app.delete('/:id', { schema: { params: IdParams } }, async (req, reply) => {
    await service.remove(req.params.id);
    return reply.code(204).send();
  });
};
