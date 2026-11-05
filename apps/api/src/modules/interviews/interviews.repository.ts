import type { InterviewDto, InterviewInput, InterviewUpdate } from '@job-tracker/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { toInterviewDto } from '../../db/mappers.js';
import { interviews } from '../../db/schema.js';

export class DrizzleInterviewsRepository {
  constructor(private readonly db: Db) {}

  async create(applicationId: string, input: InterviewInput): Promise<InterviewDto> {
    const [row] = await this.db
      .insert(interviews)
      .values({ ...input, applicationId })
      .returning();
    if (!row) throw new Error('Failed to insert interview');
    return toInterviewDto(row);
  }

  /** Returns null when the interview doesn't exist under this application. */
  async update(applicationId: string, id: string, patch: InterviewUpdate) {
    const owned = and(eq(interviews.id, id), eq(interviews.applicationId, applicationId));
    const [row] =
      Object.keys(patch).length > 0
        ? await this.db.update(interviews).set(patch).where(owned).returning()
        : await this.db.select().from(interviews).where(owned);
    return row ? toInterviewDto(row) : null;
  }

  async delete(applicationId: string, id: string) {
    const rows = await this.db
      .delete(interviews)
      .where(and(eq(interviews.id, id), eq(interviews.applicationId, applicationId)))
      .returning({ id: interviews.id });
    return rows.length > 0;
  }
}
