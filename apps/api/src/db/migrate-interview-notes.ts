import { PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { type Db, isConditionFailed, key } from './dynamo.js';
import type { InterviewItem, NoteItem } from './mappers.js';

/**
 * One-off migration for requirement 10: the single-line `notes` attribute on INTERVIEW# items becomes
 * one NOTE# item per interview (created/updated = the interview's last update), then the attribute is removed.
 * Idempotent: the note id equals the interview id and is written only if absent, so reruns never duplicate
 * and never overwrite a note the user has since edited.
 */
export async function migrateInterviewNotes(db: Db): Promise<number> {
  let migrated = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.doc.send(
      new ScanCommand({
        TableName: db.table,
        FilterExpression: 'begins_with(SK, :p) AND attribute_exists(notes)',
        ExpressionAttributeValues: { ':p': 'INTERVIEW#' },
        ExclusiveStartKey,
      }),
    );
    for (const raw of page.Items ?? []) {
      const i = raw as InterviewItem & { notes?: string | null };
      const text = typeof i.notes === 'string' ? i.notes.trim() : '';
      if (text) {
        const note: NoteItem = {
          id: i.id,
          applicationId: i.applicationId,
          interviewId: i.id,
          text,
          createdAt: i.updatedAt,
          updatedAt: i.updatedAt,
        };
        try {
          await db.doc.send(
            new PutCommand({
              TableName: db.table,
              Item: { ...key.note(i.applicationId, i.id, note.id), ...note },
              ConditionExpression: 'attribute_not_exists(PK)',
            }),
          );
          migrated++;
        } catch (err) {
          if (!isConditionFailed(err)) throw err;
        }
      }
      await db.doc.send(
        new UpdateCommand({
          TableName: db.table,
          Key: key.interview(i.applicationId, i.id),
          UpdateExpression: 'REMOVE notes',
        }),
      );
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return migrated;
}
