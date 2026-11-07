import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { FastifyPluginAsync } from 'fastify';
import { type Db, key } from '../../db/dynamo.js';

export const healthRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.get('/health', async (_req, reply) => {
    try {
      // A read of a key that never exists proves the table is reachable with the task's permissions.
      await db.doc.send(new GetCommand({ TableName: db.table, Key: key.scoutCriteria() }));
      return { status: 'ok', db: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'degraded', db: 'unreachable' });
    }
  });
};
