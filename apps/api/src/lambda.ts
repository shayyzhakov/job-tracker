// AWS Lambda entry point (Function URL, payload v2): the same Fastify app as server.ts behind an adapter.
import awsLambdaFastify from '@fastify/aws-lambda';
import { buildAppFromConfig } from './bootstrap.js';
import { loadConfig } from './config.js';
import { createDb, resolveDbConfig } from './db/dynamo.js';
import { applySsmEnv } from './ssm.js';

// Initialised once per cold start and reused by every warm invocation.
await applySsmEnv();
const { db } = createDb(resolveDbConfig());
const app = await buildAppFromConfig(loadConfig(), db);

export const handler = awsLambdaFastify(app);
