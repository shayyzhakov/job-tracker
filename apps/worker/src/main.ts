// Scout worker entry point.
//   --once  run a single scout pass and exit
//   (none)  stay up and run on SCOUT_CRON in SCOUT_TIMEZONE (local development)
// On AWS the same pass runs as a Lambda (handler.ts), started daily by EventBridge Scheduler.
import { schedule } from 'node-cron';
import { loadConfig } from './config.js';
import { createLogger, runScoutOnce } from './runner.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const run = () => runScoutOnce(config, logger);

  if (process.argv.includes('--once')) {
    await run();
    return;
  }

  logger.info('Scout scheduled', { cron: config.SCOUT_CRON, timezone: config.SCOUT_TIMEZONE });
  const task = schedule(
    config.SCOUT_CRON,
    async () => {
      try {
        await run();
      } catch (err) {
        logger.error('Scout run failed', { error: String(err) });
      }
    },
    { timezone: config.SCOUT_TIMEZONE, noOverlap: true },
  );
  const shutdown = async () => {
    await task.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
