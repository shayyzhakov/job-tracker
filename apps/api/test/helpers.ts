import { type App, type AppDeps, buildApp } from '../src/app.js';
import { clearTable } from '../src/db/clear.js';
import { createDb, type Db } from '../src/db/dynamo.js';
import { TEST_DB_CONFIG } from './db-config.js';

/** Wipes all items between tests (the table stays). */
export const resetDb = clearTable;

export interface TestApp {
  app: App;
  db: Db;
  close: () => Promise<void>;
}

export async function createTestApp(
  opts: Pick<AppDeps, 'auth' | 'mcp' | 'gamification'> = {},
): Promise<TestApp> {
  const { db, close } = createDb(TEST_DB_CONFIG);
  const app = await buildApp({ db, ...opts });
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
