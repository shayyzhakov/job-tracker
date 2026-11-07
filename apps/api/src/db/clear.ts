import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { batchDelete, type Db } from './dynamo.js';

/** Deletes every item in the table (dev seed and tests only). */
export async function clearTable(db: Db) {
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({ TableName: db.table, ProjectionExpression: 'PK, SK', ExclusiveStartKey }),
    );
    await batchDelete(
      db,
      (page.Items ?? []).map((i) => ({ PK: i.PK as string, SK: i.SK as string })),
    );
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}
