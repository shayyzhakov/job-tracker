import { type App, buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/client.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://jobtracker:jobtracker@localhost:5432/jobtracker_test';

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
