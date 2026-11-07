import { type Db, queryGsi1, queryPartition } from '../../db/dynamo.js';
import type { ApplicationItem, ContactItem, HistoryItem, InterviewItem } from '../../db/mappers.js';
import type { ProgressInput } from './build-progress.js';

/** Read-only: loads every application and its children. Personal-scale data, aggregation happens in JS. */
export class DynamoProgressRepository {
  constructor(private readonly db: Db) {}

  async load(): Promise<ProgressInput> {
    const applications = await queryGsi1<ApplicationItem>(this.db, 'APPS');
    const partitions = await Promise.all(
      applications.map((a) => queryPartition<Record<string, unknown>>(this.db, `APP#${a.id}`)),
    );
    const of = <T>(prefix: string) =>
      partitions.flat().filter((i) => String(i.SK).startsWith(prefix)) as T[];
    return {
      applications,
      history: of<HistoryItem>('HISTORY#'),
      interviews: of<InterviewItem>('INTERVIEW#'),
      contacts: of<ContactItem>('CONTACT#'),
    };
  }
}
