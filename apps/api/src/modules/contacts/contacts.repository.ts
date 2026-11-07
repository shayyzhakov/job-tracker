import { randomUUID } from 'node:crypto';
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ContactDto, ContactInput, ContactUpdate } from '@job-tracker/shared';
import { type Db, isConditionFailed, iso, key, updateExisting } from '../../db/dynamo.js';
import { type ContactItem, nul, toContactDto } from '../../db/mappers.js';

export class DynamoContactsRepository {
  constructor(private readonly db: Db) {}

  async create(applicationId: string, input: ContactInput): Promise<ContactDto> {
    const now = iso(new Date());
    const item: ContactItem = {
      id: randomUUID(),
      applicationId,
      name: input.name,
      role: nul(input.role),
      email: nul(input.email),
      phone: nul(input.phone),
      linkedinUrl: nul(input.linkedinUrl),
      notes: nul(input.notes),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.doc.send(
      new PutCommand({
        TableName: this.db.table,
        Item: { ...key.contact(applicationId, item.id), ...item },
      }),
    );
    return toContactDto(item);
  }

  /** Returns null when the contact doesn't exist under this application. */
  async update(applicationId: string, id: string, patch: ContactUpdate) {
    const set = Object.keys(patch).length > 0 ? { ...patch, updatedAt: iso(new Date()) } : {};
    const item = await updateExisting<ContactItem>(this.db, key.contact(applicationId, id), set);
    return item ? toContactDto(item) : null;
  }

  async delete(applicationId: string, id: string) {
    try {
      await this.db.doc.send(
        new DeleteCommand({
          TableName: this.db.table,
          Key: key.contact(applicationId, id),
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
