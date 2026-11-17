import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Db } from './dynamo.js';
import { key } from './dynamo.js';

/** Application-level timeline attributes replaced by per-round fields (requirement 13). */
const OLD_ATTRIBUTES = ['replyBy', 'dueAt', 'nextStep'] as const;

export interface RoundTimelineMigration {
  /** Applications whose old timeline attributes were removed. */
  cleared: number;
  /** Home assignments marked submitted from an earlier hand-over. */
  submitted: number;
}

interface ScannedItem {
  PK: string;
  SK: string;
  type?: string;
  scheduledAt?: string;
  submittedAt?: string | null;
  waitingOnThemAt?: string | null;
  replyBy?: unknown;
  dueAt?: unknown;
  nextStep?: unknown;
}

async function scanAll(db: Db): Promise<ScannedItem[]> {
  const items: ScannedItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({
        TableName: db.table,
        FilterExpression: 'begins_with(PK, :app)',
        ExpressionAttributeValues: { ':app': 'APP#' },
        ExclusiveStartKey,
      }),
    );
    items.push(...((page.Items ?? []) as ScannedItem[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * One-off migration for the round timeline: reply-by, deadline and next step moved from the
 * application onto interview rounds, and existing values are dropped rather than carried over.
 * - Removes `replyBy`, `dueAt` and `nextStep` from every APPLICATION item.
 * - A home assignment handed in before `submittedAt` existed was recorded only as the application's
 *   hand-over (`waitingOnThemAt`). The latest unsubmitted assignment received before that hand-over
 *   gets `submittedAt` = the hand-over time, so it does not come back as "submit your assignment".
 * Idempotent; returns what it changed.
 */
export async function migrateRoundTimeline(db: Db): Promise<RoundTimelineMigration> {
  const items = await scanAll(db);
  const result: RoundTimelineMigration = { cleared: 0, submitted: 0 };

  for (const app of items.filter((i) => i.SK === 'META')) {
    const present = OLD_ATTRIBUTES.filter((a) => app[a] !== undefined);
    if (present.length > 0) {
      await db.doc.send(
        new UpdateCommand({
          TableName: db.table,
          Key: { PK: app.PK, SK: app.SK },
          UpdateExpression: `REMOVE ${present.join(', ')}`,
        }),
      );
      result.cleared++;
    }

    const handedOver = app.waitingOnThemAt;
    if (!handedOver) continue;
    const assignment = items
      .filter(
        (i) =>
          i.PK === app.PK &&
          i.SK.startsWith('INTERVIEW#') &&
          i.type === 'home_assignment' &&
          (i.scheduledAt ?? '') <= handedOver,
      )
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
      .at(-1);
    if (assignment && !assignment.submittedAt) {
      const appId = app.PK.slice('APP#'.length);
      await db.doc.send(
        new UpdateCommand({
          TableName: db.table,
          Key: key.interview(appId, assignment.SK.slice('INTERVIEW#'.length)),
          UpdateExpression: 'SET submittedAt = :at',
          ExpressionAttributeValues: { ':at': handedOver },
        }),
      );
      result.submitted++;
    }
  }
  return result;
}
