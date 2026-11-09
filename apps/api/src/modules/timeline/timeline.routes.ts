import type { TimelineInterviewDto } from '@job-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const QuerySchema = z.object({ from: z.coerce.date(), to: z.coerce.date().optional() });

export const timelineRoutes: FastifyPluginAsyncZod<{
  repo: { list(from: Date, to?: Date): Promise<TimelineInterviewDto[]> };
}> = async (app, { repo }) => {
  /** Interview rounds of all applications from `from` on (up to `to` when given), earliest first. */
  app.get('/', { schema: { querystring: QuerySchema } }, (req) =>
    repo.list(req.query.from, req.query.to),
  );
};
