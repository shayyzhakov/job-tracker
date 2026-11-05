import { sql } from 'drizzle-orm';
import { type App, buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/client.js';
import { TEST_DATABASE_URL } from './db-url.js';

/** Wipes all data between tests (schema stays). */
export async function resetDb(db: Db) {
  await db.execute(
    sql`truncate table status_history, interviews, contacts, applications, companies restart identity cascade`,
  );
}

export interface TestApp {
  app: App;
  db: Db;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const { db, close } = createDb(TEST_DATABASE_URL);
  const app = await buildApp({ db });
  await app.ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await close();
    },
  };
}
