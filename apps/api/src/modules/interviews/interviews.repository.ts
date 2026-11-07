import { randomUUID } from 'node:crypto';
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { InterviewDto, InterviewInput, InterviewUpdate } from '@job-tracker/shared';
import { type Db, isConditionFailed, iso, key, updateExisting } from '../../db/dynamo.js';
import { type InterviewItem, nul, toInterviewDto } from '../../db/mappers.js';
import { interviewIndexKeys } from '../applications/applications.repository.js';

export class DynamoInterviewsRepository {
  constructor(private readonly db: Db) {}

  async create(applicationId: string, input: InterviewInput): Promise<InterviewDto> {
    const now = iso(new Date());
    const item: InterviewItem = {
      id: randomUUID(),
      applicationId,
      type: input.type,
      scheduledAt: iso(input.scheduledAt),
      durationMinutes: nul(input.durationMinutes),
      location: nul(input.location),
      notes: nul(input.notes),
      timeUnknown: input.timeUnknown ?? false,
      debriefedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.doc.send(
      new PutCommand({
        TableName: this.db.table,
        Item: {
          ...key.interview(applicationId, item.id),
          ...interviewIndexKeys(item.id, item.scheduledAt),
          ...item,
        },
      }),
    );
    return toInterviewDto(item);
  }

  /** Returns null when the interview doesn't exist under this application. */
  async update(applicationId: string, id: string, patch: InterviewUpdate) {
    const { scheduledAt, debriefed, ...rest } = patch;
    const set: Record<string, unknown> = { ...rest };
    if (debriefed !== undefined) set.debriefedAt = debriefed ? iso(new Date()) : null;
    if (scheduledAt) {
      set.scheduledAt = iso(scheduledAt);
      set.timeUnknown = false;
      set.GSI1SK = interviewIndexKeys(id, iso(scheduledAt)).GSI1SK;
    }
    if (Object.keys(set).length > 0) set.updatedAt = iso(new Date());
    const item = await updateExisting<InterviewItem>(
      this.db,
      key.interview(applicationId, id),
      set,
    );
    return item ? toInterviewDto(item) : null;
  }

  async delete(applicationId: string, id: string) {
    try {
      await this.db.doc.send(
        new DeleteCommand({
          TableName: this.db.table,
          Key: key.interview(applicationId, id),
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
