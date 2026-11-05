import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../../db/client.js';

export const healthRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.get('/health', async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'degraded', db: 'unreachable' });
    }
  });
};
