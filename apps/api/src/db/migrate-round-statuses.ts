import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  INTERVIEW_ROUND_STATUSES,
  INTERVIEW_TYPE_ROUND_STATUS,
  ROUND_STATUS_INTERVIEW_TYPE,
} from '@job-tracker/shared';
import { DynamoInterviewsRepository } from '../modules/interviews/interviews.repository.js';
import { type Db, queryPartition } from './dynamo.js';
import type { ApplicationItem, InterviewItem } from './mappers.js';

/**
 * One-off migration to "only milestones are stored": an application whose stored status is an
 * interview round is reset to `applied`. If it has no interview with a stage, the round it claimed is
 * recorded as a placeholder interview (time unknown, dated at the last status change), so no round
 * disappears; if it has one (for example a coffee chat stored as HR screening), the interviews already
 * say where it stands and nothing is added. Status history is left as it was. Idempotent; returns the
 * number of applications changed.
 */
export async function migrateRoundStatuses(db: Db): Promise<number> {
  const interviews = new DynamoInterviewsRepository(db);
  const rounds = new Set<string>(INTERVIEW_ROUND_STATUSES);
  let changed = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({
        TableName: db.table,
        FilterExpression: 'SK = :meta AND begins_with(PK, :app)',
        ExpressionAttributeValues: { ':meta': 'META', ':app': 'APP#' },
        ExclusiveStartKey,
      }),
    );
    for (const app of (page.Items ?? []) as (ApplicationItem & { PK: string })[]) {
      if (!rounds.has(app.status)) continue;
      const items = await queryPartition<InterviewItem>(db, app.PK, 'INTERVIEW#');
      const hasStaged = items.some((i) => INTERVIEW_TYPE_ROUND_STATUS[i.type]);
      if (!hasStaged) {
        await interviews.create(app.id, {
          type: ROUND_STATUS_INTERVIEW_TYPE[app.status as keyof typeof ROUND_STATUS_INTERVIEW_TYPE],
          scheduledAt: new Date(app.statusChangedAt ?? app.updatedAt),
          timeUnknown: true,
        });
      }
      await db.doc.send(
        new UpdateCommand({
          TableName: db.table,
          Key: { PK: app.PK, SK: 'META' },
          UpdateExpression: 'SET #s = :applied',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':applied': 'applied' },
        }),
      );
      changed++;
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return changed;
}
