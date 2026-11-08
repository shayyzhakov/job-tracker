import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Db } from './dynamo.js';

const OLD = 'unicorn';
const NEW = 'scale_up';

/**
 * One-off migration: the company size `unicorn` was renamed `scale_up`. Rewrites every stored occurrence:
 * `size` on COMPANY items, `companySize` on OPPORTUNITY items and `criteria.companySizes` on the scout
 * criteria item. Idempotent (items already migrated no longer match); returns the number of items changed.
 */
export async function migrateUnicornToScaleUp(db: Db): Promise<number> {
  let changed = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({
        TableName: db.table,
        FilterExpression: '#s = :old OR #cs = :old OR contains(#c.#cz, :old)',
        ExpressionAttributeNames: {
          '#s': 'size',
          '#cs': 'companySize',
          '#c': 'criteria',
          '#cz': 'companySizes',
        },
        ExpressionAttributeValues: { ':old': OLD },
        ExclusiveStartKey,
      }),
    );
    for (const item of page.Items ?? []) {
      const Key = { PK: item.PK, SK: item.SK };
      if (item.size === OLD) {
        await db.doc.send(
          new UpdateCommand({
            TableName: db.table,
            Key,
            UpdateExpression: 'SET #s = :new',
            ExpressionAttributeNames: { '#s': 'size' },
            ExpressionAttributeValues: { ':new': NEW },
          }),
        );
        changed++;
      } else if (item.companySize === OLD) {
        await db.doc.send(
          new UpdateCommand({
            TableName: db.table,
            Key,
            UpdateExpression: 'SET companySize = :new',
            ExpressionAttributeValues: { ':new': NEW },
          }),
        );
        changed++;
      } else if (Array.isArray(item.criteria?.companySizes)) {
        const companySizes = [
          ...new Set((item.criteria.companySizes as string[]).map((s) => (s === OLD ? NEW : s))),
        ];
        await db.doc.send(
          new UpdateCommand({
            TableName: db.table,
            Key,
            UpdateExpression: 'SET criteria.companySizes = :sizes',
            ExpressionAttributeValues: { ':sizes': companySizes },
          }),
        );
        changed++;
      }
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return changed;
}
