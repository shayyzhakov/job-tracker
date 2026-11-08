// One-off: `pnpm db:migrate-company-sizes` renames the stored company size `unicorn` to `scale_up`.
// Runs against whatever DYNAMODB_TABLE / AWS credentials the environment points to (DynamoDB Local or AWS).
import { createDb, resolveDbConfig } from './dynamo.js';
import { migrateUnicornToScaleUp } from './migrate-company-sizes.js';

const config = resolveDbConfig();
const { db, close } = createDb(config);
const changed = await migrateUnicornToScaleUp(db);
console.log(`Migrated ${changed} item(s) from unicorn to scale_up in table ${config.table}`);
await close();
