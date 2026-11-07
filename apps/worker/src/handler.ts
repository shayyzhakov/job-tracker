// AWS Lambda entry point: one scout pass, invoked daily by EventBridge Scheduler.
import { applySsmEnv } from '@job-tracker/api/scout';
import { loadConfig } from './config.js';
import { createLogger, runScoutOnce } from './runner.js';

// Secrets (ANTHROPIC_API_KEY) come from SSM Parameter Store once per cold start.
await applySsmEnv();

export const handler = async () => {
  const config = loadConfig();
  return runScoutOnce(config, createLogger(config.LOG_LEVEL));
};
