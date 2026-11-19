// One-off: `pnpm db:migrate-status-history` lists the status histories that the "history stays
// logical" rules would rewrite (loops, a ghosted the company answered after, a replaced outcome).
// Add `--write` to apply. Runs against whatever DYNAMODB_TABLE / AWS credentials the environment
// points to (DynamoDB Local or AWS).
import { STATUS_LABELS } from '@job-tracker/shared';
import { createDb, resolveDbConfig } from './dynamo.js';
import { migrateStatusHistory } from './migrate-status-history.js';

const write = process.argv.includes('--write');
const config = resolveDbConfig();
const { db, close } = createDb(config);
const changes = await migrateStatusHistory(db, { write });
const path = (statuses: (keyof typeof STATUS_LABELS)[]) =>
  statuses.map((s) => STATUS_LABELS[s]).join(' → ');
for (const c of changes) {
  console.log(`${c.roleName} (${c.applicationId})\n  ${path(c.before)}\n  ${path(c.after)}`);
}
console.log(
  `${write ? 'Rewrote' : 'Would rewrite (dry run, add --write to apply)'} the history of ${changes.length} application(s) in table ${config.table}`,
);
await close();
