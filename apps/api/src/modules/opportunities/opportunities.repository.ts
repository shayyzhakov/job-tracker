import { createHash, randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  CompanySize,
  OpportunityDto,
  OpportunityListQuery,
  OpportunityStatus,
} from '@job-tracker/shared';
import {
  batchGet,
  buildUpdate,
  type Db,
  isConditionFailed,
  iso,
  isoOrNull,
  isTransactionCancelled,
  key,
  queryGsi1,
} from '../../db/dynamo.js';
import { nul, type OpportunityItem, toOpportunityDto } from '../../db/mappers.js';

export interface NewOpportunity {
  /** Already normalised with normalizeListingUrl. */
  listingUrl: string;
  source: string;
  companyName: string;
  title: string;
  location: string | null;
  description: string;
  postedAt: Date | null;
  score: number;
  summary: string;
  reasons: string[];
  isManagement: boolean;
  companySize: CompanySize | null;
  status: OpportunityStatus;
}

export interface StatusChange {
  from: OpportunityStatus;
  to: OpportunityStatus;
  applicationId?: string | null;
}

export interface OpportunitiesRepository {
  list(query: OpportunityListQuery): Promise<OpportunityDto[]>;
  findById(id: string): Promise<OpportunityDto | null>;
  findByUrl(listingUrl: string): Promise<OpportunityDto | null>;
  /** The subset of `urls` already stored. */
  existingUrls(urls: string[]): Promise<Set<string>>;
  /** Inserts rows, silently skipping URLs that already exist. Returns how many were inserted. */
  insertMany(rows: NewOpportunity[]): Promise<number>;
  /** Compare-and-set on status; returns false if the row is missing or not in `from`. */
  changeStatus(id: string, change: StatusChange): Promise<boolean>;
}

// Listing URLs can be long and contain characters that are awkward in keys, so the unique-URL marker uses a hash.
const urlKey = (listingUrl: string) =>
  key.opportunityUrl(createHash('sha256').update(listingUrl).digest('hex'));

/** Per status, best score first (list reads GSI1 backwards). Scores are 0–100, zero-padded to sort as text. */
const statusIndexKeys = (o: Pick<OpportunityItem, 'id' | 'status' | 'score' | 'createdAt'>) => ({
  GSI1PK: `OPPSTATUS#${o.status}`,
  GSI1SK: `${String(Math.max(0, Math.round(o.score))).padStart(5, '0')}#${o.createdAt}#${o.id}`,
});

/** Sparse index: only opportunities promoted to an application, so deleting it can unlink them. */
const applicationIndexKeys = (id: string, applicationId: string) => ({
  GSI2PK: `APPOPP#${applicationId}`,
  GSI2SK: id,
});

export class DynamoOpportunitiesRepository implements OpportunitiesRepository {
  constructor(private readonly db: Db) {}

  async list({ status }: OpportunityListQuery) {
    const items = await queryGsi1<OpportunityItem>(this.db, `OPPSTATUS#${status}`, { desc: true });
    return items.map(toOpportunityDto);
  }

  private async getItem(id: string) {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.opportunity(id) }),
    );
    return (res.Item as OpportunityItem | undefined) ?? null;
  }

  async findById(id: string) {
    const item = await this.getItem(id);
    return item ? toOpportunityDto(item) : null;
  }

  async findByUrl(listingUrl: string) {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: urlKey(listingUrl) }),
    );
    const id = res.Item?.opportunityId as string | undefined;
    return id ? this.findById(id) : null;
  }

  async existingUrls(urls: string[]) {
    if (urls.length === 0) return new Set<string>();
    const found = await batchGet<{ listingUrl: string }>(this.db, urls.map(urlKey));
    return new Set(found.map((m) => m.listingUrl));
  }

  async insertMany(rows: NewOpportunity[]) {
    let inserted = 0;
    for (const row of rows) {
      const now = iso(new Date());
      const item: OpportunityItem = {
        id: randomUUID(),
        listingUrl: row.listingUrl,
        source: row.source,
        companyName: row.companyName,
        title: row.title,
        location: nul(row.location),
        description: row.description,
        postedAt: isoOrNull(row.postedAt),
        score: row.score,
        summary: row.summary,
        reasons: row.reasons,
        isManagement: row.isManagement,
        companySize: nul(row.companySize),
        status: row.status,
        applicationId: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await this.db.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.db.table,
                  Item: {
                    ...urlKey(item.listingUrl),
                    listingUrl: item.listingUrl,
                    opportunityId: item.id,
                  },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              {
                Put: {
                  TableName: this.db.table,
                  Item: { ...key.opportunity(item.id), ...statusIndexKeys(item), ...item },
                },
              },
            ],
          }),
        );
        inserted++;
      } catch (err) {
        // The URL marker already exists: skip, like ON CONFLICT DO NOTHING.
        if (!isTransactionCancelled(err)) throw err;
      }
    }
    return inserted;
  }

  async changeStatus(id: string, { from, to, applicationId }: StatusChange) {
    const current = await this.getItem(id);
    if (!current || current.status !== from) return false;
    const linkChanged = applicationId !== undefined;
    const nextApplicationId = linkChanged ? applicationId : current.applicationId;
    const built = buildUpdate(
      {
        status: to,
        updatedAt: iso(new Date()),
        ...statusIndexKeys({ ...current, status: to }),
        ...(linkChanged && { applicationId: nextApplicationId }),
        ...(nextApplicationId && applicationIndexKeys(id, nextApplicationId)),
      },
      nextApplicationId ? [] : ['GSI2PK', 'GSI2SK'],
    );
    try {
      await this.db.doc.send(
        new UpdateCommand({
          TableName: this.db.table,
          Key: key.opportunity(id),
          // Compare-and-set: only move the row if nobody changed its status meanwhile.
          ConditionExpression: '#status = :expected',
          ...built,
          ExpressionAttributeNames: { ...built.ExpressionAttributeNames, '#status': 'status' },
          ExpressionAttributeValues: { ...built.ExpressionAttributeValues, ':expected': from },
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailed(err)) return false;
      throw err;
    }
  }
}
