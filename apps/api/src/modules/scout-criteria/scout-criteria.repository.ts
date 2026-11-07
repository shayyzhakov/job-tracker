import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  type ScoutCriteria,
  type ScoutCriteriaDto,
  ScoutCriteriaSchema,
} from '@job-tracker/shared';
import { type Db, iso, key } from '../../db/dynamo.js';

export interface ScoutCriteriaRepository {
  /** The saved criteria, or the defaults when nothing has been saved yet. */
  get(): Promise<ScoutCriteriaDto>;
  save(criteria: ScoutCriteria): Promise<ScoutCriteriaDto>;
}

// Re-parse stored JSON so criteria saved before a new field existed pick up its default.
const toDto = (row?: { criteria: unknown; updatedAt: string }): ScoutCriteriaDto => ({
  ...ScoutCriteriaSchema.parse(row?.criteria ?? {}),
  updatedAt: row ? row.updatedAt : null,
});

export class DynamoScoutCriteriaRepository implements ScoutCriteriaRepository {
  constructor(private readonly db: Db) {}

  async get() {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.scoutCriteria() }),
    );
    return toDto(res.Item as { criteria: unknown; updatedAt: string } | undefined);
  }

  async save(criteria: ScoutCriteria) {
    const row = { criteria, updatedAt: iso(new Date()) };
    await this.db.doc.send(
      new PutCommand({ TableName: this.db.table, Item: { ...key.scoutCriteria(), ...row } }),
    );
    return toDto(row);
  }
}
