import { randomUUID } from 'node:crypto';
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { NoteDto } from '@job-tracker/shared';
import { type Db, isConditionFailed, iso, key, updateExisting } from '../../db/dynamo.js';
import { type NoteItem, toNoteDto } from '../../db/mappers.js';

export class DynamoNotesRepository {
  constructor(private readonly db: Db) {}

  async interviewExists(applicationId: string, interviewId: string): Promise<boolean> {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.interview(applicationId, interviewId) }),
    );
    return !!res.Item;
  }

  async create(applicationId: string, interviewId: string, text: string): Promise<NoteDto> {
    const now = iso(new Date());
    const item: NoteItem = {
      id: randomUUID(),
      applicationId,
      interviewId,
      text,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.doc.send(
      new PutCommand({
        TableName: this.db.table,
        Item: { ...key.note(applicationId, interviewId, item.id), ...item },
      }),
    );
    return toNoteDto(item);
  }

  /** Returns null when the note doesn't exist under this interview. */
  async update(applicationId: string, interviewId: string, id: string, text: string) {
    const item = await updateExisting<NoteItem>(this.db, key.note(applicationId, interviewId, id), {
      text,
      updatedAt: iso(new Date()),
    });
    return item ? toNoteDto(item) : null;
  }

  async delete(applicationId: string, interviewId: string, id: string) {
    try {
      await this.db.doc.send(
        new DeleteCommand({
          TableName: this.db.table,
          Key: key.note(applicationId, interviewId, id),
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailed(err)) return false;
      throw err;
    }
  }
}
