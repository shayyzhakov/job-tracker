import { runMigrations } from '../src/db/migrate.js';
import { TEST_DATABASE_URL } from './db-url.js';

// Runs once before the API test suite: brings the test DB schema up to date.
export default async function setup() {
  await runMigrations(TEST_DATABASE_URL);
}
