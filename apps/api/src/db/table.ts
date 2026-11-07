import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { createDb, type DbConfig, resolveDbConfig } from './dynamo.js';

/**
 * Keep in sync with infra/modules/dynamodb/main.tf. Used for DynamoDB Local (dev + tests);
 * on AWS the table is created by OpenTofu.
 */
export const TABLE_DEFINITION = {
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: ['GSI1', 'GSI2'].map((name) => ({
    IndexName: name,
    KeySchema: [
      { AttributeName: `${name}PK`, KeyType: 'HASH' },
      { AttributeName: `${name}SK`, KeyType: 'RANGE' },
    ],
    Projection: { ProjectionType: 'ALL' },
  })),
  BillingMode: 'PAY_PER_REQUEST',
} as const;

/** Creates the table (and waits for it) when it doesn't exist yet. Idempotent. */
export async function ensureTable(config: DbConfig = resolveDbConfig()) {
  const { db, close } = createDb(config);
  try {
    try {
      await db.client.send(new DescribeTableCommand({ TableName: db.table }));
      return false;
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) throw err;
    }
    await db.client.send(
      new CreateTableCommand({
        ...TABLE_DEFINITION,
        TableName: db.table,
        // Cast: the SDK wants mutable arrays.
      } as never),
    );
    await waitUntilTableExists({ client: db.client, maxWaitTime: 30 }, { TableName: db.table });
    return true;
  } finally {
    await close();
  }
}

// CLI: `pnpm db:setup`
if (import.meta.url === `file://${process.argv[1]}`) {
  const created = await ensureTable();
  console.log(created ? 'Table created' : 'Table already exists');
}
