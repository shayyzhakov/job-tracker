// One-off: `pnpm db:migrate-round-timeline` drops the application-level reply-by, deadline and next
// step (they now live on interview rounds) and marks home assignments already handed in as submitted.
// Runs against whatever DYNAMODB_TABLE / AWS credentials the environment points to (DynamoDB Local or AWS).
import { createDb, resolveDbConfig } from './dynamo.js';
import { migrateRoundTimeline } from './migrate-round-timeline.js';

const config = resolveDbConfig();
const { db, close } = createDb(config);
const { cleared, submitted } = await migrateRoundTimeline(db);
console.log(
  `Cleared the old timeline on ${cleared} application(s) and marked ${submitted} home assignment(s) submitted in table ${config.table}`,
);
await close();
