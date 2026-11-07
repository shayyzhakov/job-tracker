import type { DbConfig } from '../src/db/dynamo.js';

/** DynamoDB Local (docker compose) with a table of its own, so tests never touch dev data. */
export const TEST_DB_CONFIG: DbConfig = {
  table: process.env.TEST_DYNAMODB_TABLE ?? 'job-tracker-test',
  endpoint: process.env.TEST_DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  region: 'us-east-1',
};
