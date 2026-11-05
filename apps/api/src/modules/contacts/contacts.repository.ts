import type { ContactDto, ContactInput, ContactUpdate } from '@job-tracker/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { toContactDto } from '../../db/mappers.js';
import { contacts } from '../../db/schema.js';

export class DrizzleContactsRepository {
  constructor(private readonly db: Db) {}

  async create(applicationId: string, input: ContactInput): Promise<ContactDto> {
    const [row] = await this.db
      .insert(contacts)
      .values({ ...input, applicationId })
      .returning();
    if (!row) throw new Error('Failed to insert contact');
    return toContactDto(row);
  }

  /** Returns null when the contact doesn't exist under this application. */
  async update(applicationId: string, id: string, patch: ContactUpdate) {
    const owned = and(eq(contacts.id, id), eq(contacts.applicationId, applicationId));
    const [row] =
      Object.keys(patch).length > 0
        ? await this.db.update(contacts).set(patch).where(owned).returning()
        : await this.db.select().from(contacts).where(owned);
    return row ? toContactDto(row) : null;
  }

  async delete(applicationId: string, id: string) {
    const rows = await this.db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.applicationId, applicationId)))
      .returning({ id: contacts.id });
    return rows.length > 0;
  }
}
