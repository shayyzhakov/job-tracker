import type { ProgressDto } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { buildProgress, type ProgressInput } from './build-progress.js';

export interface ProgressSource {
  load(): Promise<ProgressInput>;
}

/** GET /progress — facts for the optional gamification layer. Only registered when it is enabled. */
export const progressRoutes: FastifyPluginAsyncZod<{
  source: ProgressSource;
  now?: () => Date;
}> = async (app, { source, now = () => new Date() }) => {
  app.get('/', async (): Promise<ProgressDto> => buildProgress(await source.load(), now()));
};
