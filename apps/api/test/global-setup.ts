import { ensureTable } from '../src/db/table.js';
import { TEST_DB_CONFIG } from './db-config.js';

// Runs once before the API test suite: makes sure the test table exists in DynamoDB Local.
export default async function setup() {
  await ensureTable(TEST_DB_CONFIG);
}
