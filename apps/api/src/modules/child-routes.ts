// Shared CRUD routes for entities nested under an application (contacts, interviews).
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NotFoundError } from '../errors.js';
import type { ApplicationsRepository } from './applications/applications.repository.js';

interface ChildRepository<TInput, TUpdate, TDto> {
  create(applicationId: string, input: TInput): Promise<TDto>;
  update(applicationId: string, id: string, patch: TUpdate): Promise<TDto | null>;
  delete(applicationId: string, id: string): Promise<boolean>;
}

export function childRoutes<TInput, TUpdate, TDto>(opts: {
  entity: string;
  inputSchema: z.ZodType<TInput>;
  updateSchema: z.ZodType<TUpdate>;
  repo: ChildRepository<TInput, TUpdate, TDto>;
  applications: ApplicationsRepository;
}): FastifyPluginAsyncZod {
  const { entity, inputSchema, updateSchema, repo, applications } = opts;
  const AppParams = z.object({ applicationId: z.uuid() });
  const ChildParams = AppParams.extend({ id: z.uuid() });

  const requireApplication = async (id: string) => {
    if (!(await applications.getState(id))) throw new NotFoundError('Application', id);
  };

  return async (app) => {
    app.post('/', { schema: { params: AppParams, body: inputSchema } }, async (req, reply) => {
      await requireApplication(req.params.applicationId);
      return reply.code(201).send(await repo.create(req.params.applicationId, req.body as TInput));
    });

    app.patch('/:id', { schema: { params: ChildParams, body: updateSchema } }, async (req) => {
      const updated = await repo.update(
        req.params.applicationId,
        req.params.id,
        req.body as TUpdate,
      );
      if (!updated) throw new NotFoundError(entity, req.params.id);
      return updated;
    });

    app.delete('/:id', { schema: { params: ChildParams } }, async (req, reply) => {
      if (!(await repo.delete(req.params.applicationId, req.params.id))) {
        throw new NotFoundError(entity, req.params.id);
      }
      return reply.code(204).send();
    });
  };
}
