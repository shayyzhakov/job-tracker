import { buildAppFromConfig } from './bootstrap.js';
import { loadConfig } from './config.js';
import { createDb, resolveDbConfig } from './db/dynamo.js';

const config = loadConfig();
const { db, close } = createDb(resolveDbConfig());
const app = await buildAppFromConfig(config, db);

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.API_PORT, host: config.HOST });
