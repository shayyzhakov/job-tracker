// One-off: `pnpm db:migrate-notes` moves legacy single-line interview notes into note items.
// Runs against whatever DYNAMODB_TABLE / AWS credentials the environment points to (DynamoDB Local or AWS).
import { createDb, resolveDbConfig } from './dynamo.js';
import { migrateInterviewNotes } from './migrate-interview-notes.js';

const config = resolveDbConfig();
const { db, close } = createDb(config);
const migrated = await migrateInterviewNotes(db);
console.log(`Migrated ${migrated} interview note(s) in table ${config.table}`);
await close();
