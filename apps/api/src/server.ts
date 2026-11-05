import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const app = await buildApp({
  db,
  webDistDir: config.WEB_DIST_DIR,
  logger: {
    level: config.LOG_LEVEL,
    // Pretty logs locally; JSON in production (CloudWatch-friendly).
    ...(config.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { colorize: true } },
    }),
  },
});

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
