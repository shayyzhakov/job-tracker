import { NoteInputSchema, NoteUpdateSchema } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { NotesService } from './notes.service.js';

/** Mounted at /applications/:applicationId/interviews/:interviewId/notes. Notes are read via the application. */
export const notesRoutes: FastifyPluginAsyncZod<{ service: NotesService }> = async (
  app,
  { service },
) => {
  const InterviewParams = z.object({ applicationId: z.uuid(), interviewId: z.uuid() });
  const NoteParams = InterviewParams.extend({ id: z.uuid() });

  app.post(
    '/',
    { schema: { params: InterviewParams, body: NoteInputSchema } },
    async (req, reply) =>
      reply
        .code(201)
        .send(await service.create(req.params.applicationId, req.params.interviewId, req.body)),
  );

  app.patch('/:id', { schema: { params: NoteParams, body: NoteUpdateSchema } }, (req) =>
    service.update(req.params.applicationId, req.params.interviewId, req.params.id, req.body),
  );

  app.delete('/:id', { schema: { params: NoteParams } }, async (req, reply) => {
    await service.remove(req.params.applicationId, req.params.interviewId, req.params.id);
    return reply.code(204).send();
  });
};
