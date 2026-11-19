import { DeleteCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { type ApplicationStatus, cleanHistory, isRoundStatus } from '@job-tracker/shared';
import type { Db } from './dynamo.js';
import { key } from './dynamo.js';

interface ScannedItem {
  PK: string;
  SK: string;
  id?: string;
  roleName?: string;
  fromStatus?: ApplicationStatus | null;
  toStatus?: ApplicationStatus;
  changedAt?: string;
  reachedStatuses?: ApplicationStatus[];
}

export interface StatusHistoryChange {
  applicationId: string;
  roleName: string;
  before: ApplicationStatus[];
  after: ApplicationStatus[];
}

async function scanAll(db: Db): Promise<ScannedItem[]> {
  const items: ScannedItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({
        TableName: db.table,
        FilterExpression: 'begins_with(PK, :app) AND (SK = :meta OR begins_with(SK, :history))',
        ExpressionAttributeValues: { ':app': 'APP#', ':meta': 'META', ':history': 'HISTORY#' },
        ExclusiveStartKey,
      }),
    );
    items.push(...((page.Items ?? []) as ScannedItem[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * One-off: replays every application's status history through the "history stays logical" rules
 * (requirement 01, `cleanHistory`), as if they had applied from the start. Drops loops and superseded
 * rows, fixes `fromStatus` on the rows after them, and recomputes the milestones in `reachedStatuses`
 * from what is left. Interviews are not touched. With `write: false` it only reports what it would
 * change. Idempotent.
 */
export async function migrateStatusHistory(
  db: Db,
  { write }: { write: boolean },
): Promise<StatusHistoryChange[]> {
  const items = await scanAll(db);
  const changes: StatusHistoryChange[] = [];

  for (const app of items.filter((i) => i.SK === 'META')) {
    const appId = app.PK.slice('APP#'.length);
    const history = items
      .filter((i) => i.PK === app.PK && i.SK.startsWith('HISTORY#') && i.toStatus)
      .sort((a, b) => a.SK.localeCompare(b.SK)) as (ScannedItem & {
      toStatus: ApplicationStatus;
    })[];
    const { drop, relink } = cleanHistory(history);
    if (drop.length === 0 && relink.length === 0) continue;

    const kept = history.filter((h) => !drop.includes(h));
    changes.push({
      applicationId: appId,
      roleName: app.roleName ?? '',
      before: history.map((h) => h.toStatus),
      after: kept.map((h) => h.toStatus),
    });
    if (!write) continue;

    for (const h of drop) {
      await db.doc.send(new DeleteCommand({ TableName: db.table, Key: { PK: h.PK, SK: h.SK } }));
    }
    for (const { row, fromStatus } of relink) {
      await db.doc.send(
        new UpdateCommand({
          TableName: db.table,
          Key: { PK: row.PK, SK: row.SK },
          UpdateExpression: 'SET fromStatus = :from',
          ExpressionAttributeValues: { ':from': fromStatus },
        }),
      );
    }
    const reached = [
      ...new Set([
        ...(app.reachedStatuses ?? []).filter(isRoundStatus),
        ...kept.map((h) => h.toStatus),
      ]),
    ];
    await db.doc.send(
      new UpdateCommand({
        TableName: db.table,
        Key: key.app(appId),
        UpdateExpression: 'SET reachedStatuses = :reached',
        ExpressionAttributeValues: { ':reached': reached },
      }),
    );
  }
  return changes;
}
