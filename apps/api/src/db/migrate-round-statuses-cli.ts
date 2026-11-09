// One-off: `pnpm db:migrate-round-statuses` resets stored interview-round statuses to `applied`
// (rounds now come from interviews; only milestones are stored).
// Runs against whatever DYNAMODB_TABLE / AWS credentials the environment points to (DynamoDB Local or AWS).
import { createDb, resolveDbConfig } from './dynamo.js';
import { migrateRoundStatuses } from './migrate-round-statuses.js';

const config = resolveDbConfig();
const { db, close } = createDb(config);
const changed = await migrateRoundStatuses(db);
console.log(
  `Migrated ${changed} application(s) off stored round statuses in table ${config.table}`,
);
await close();
