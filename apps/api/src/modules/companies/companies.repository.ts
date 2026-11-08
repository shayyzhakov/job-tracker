import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  ApplicationUpdate,
  CompanyApplicationDto,
  CompanyDto,
  CompanyInput,
} from '@job-tracker/shared';
import { buildUpdate, type Db, isTransactionCancelled, key, queryGsi1 } from '../../db/dynamo.js';
import { type ApplicationItem, type CompanyItem, nul, toCompanyDto } from '../../db/mappers.js';
import { ConflictError } from '../../errors.js';

export type CompanyPatch = NonNullable<ApplicationUpdate['company']>;

export interface CompaniesRepository {
  findById(id: string): Promise<CompanyDto | null>;
  /** Case-insensitive exact match. */
  findByName(name: string): Promise<CompanyDto | null>;
  create(input: CompanyInput): Promise<CompanyDto>;
  update(id: string, patch: CompanyPatch): Promise<void>;
  search(q?: string): Promise<CompanyDto[]>;
  /** Every company matching the name filter (no result cap), sorted by name. */
  list(q?: string): Promise<CompanyDto[]>;
  /** Applications grouped by company id. Companies without applications are absent. */
  applicationsByCompany(): Promise<Map<string, CompanyApplicationDto[]>>;
  /** Removes the company and frees its name. The caller checks that it has no applications. */
  delete(id: string): Promise<void>;
}

const SEARCH_LIMIT = 50;
const gsiSortKey = (name: string, id: string) => `${name.toLowerCase()}#${id}`;

export class DynamoCompaniesRepository implements CompaniesRepository {
  constructor(private readonly db: Db) {}

  private async getItem(id: string): Promise<CompanyItem | null> {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.company(id) }),
    );
    return (res.Item as CompanyItem | undefined) ?? null;
  }

  async findById(id: string) {
    const item = await this.getItem(id);
    return item ? toCompanyDto(item) : null;
  }

  async findByName(name: string) {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.companyName(name) }),
    );
    const companyId = res.Item?.companyId as string | undefined;
    return companyId ? this.findById(companyId) : null;
  }

  async create(input: CompanyInput) {
    const now = new Date().toISOString();
    const item: CompanyItem = {
      id: randomUUID(),
      name: input.name,
      size: nul(input.size),
      isPublic: input.isPublic ?? false,
      website: nul(input.website),
      location: nul(input.location),
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
                  ...key.company(item.id),
                  GSI1PK: 'COMPANIES',
                  GSI1SK: gsiSortKey(item.name, item.id),
                  ...item,
                },
              },
            },
            {
              // Unique, case-insensitive company name.
              Put: {
                TableName: this.db.table,
                Item: { ...key.companyName(item.name), companyId: item.id },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
          ],
        }),
      );
    } catch (err) {
      if (isTransactionCancelled(err)) {
        throw new ConflictError(`Company "${item.name}" already exists`);
      }
      throw err;
    }
    return toCompanyDto(item);
  }

  async update(id: string, patch: CompanyPatch) {
    if (Object.keys(patch).length === 0) return;
    const current = await this.getItem(id);
    if (!current) return;
    const updatedAt = new Date().toISOString();
    const renamed =
      patch.name !== undefined && patch.name.toLowerCase() !== current.name.toLowerCase();
    const set = {
      ...patch,
      updatedAt,
      ...(patch.name !== undefined && { GSI1SK: gsiSortKey(patch.name, id) }),
    };
    const update = {
      TableName: this.db.table,
      Key: key.company(id),
      ConditionExpression: 'attribute_exists(PK)',
      ...buildUpdate(set),
    };
    if (!renamed) {
      await this.db.doc.send(new UpdateCommand(update));
      return;
    }
    const newName = patch.name as string;
    try {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            { Update: update },
            {
              Put: {
                TableName: this.db.table,
                Item: { ...key.companyName(newName), companyId: id },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            { Delete: { TableName: this.db.table, Key: key.companyName(current.name) } },
          ],
        }),
      );
    } catch (err) {
      if (isTransactionCancelled(err)) {
        throw new ConflictError(`Company "${newName}" already exists`);
      }
      throw err;
    }
  }

  async search(q?: string) {
    return (await this.list(q)).slice(0, SEARCH_LIMIT);
  }

  async list(q?: string) {
    // Personal-scale data: read the name-sorted index and filter in memory.
    const items = await queryGsi1<CompanyItem>(this.db, 'COMPANIES');
    const needle = q?.toLowerCase();
    return items.filter((c) => !needle || c.name.toLowerCase().includes(needle)).map(toCompanyDto);
  }

  async applicationsByCompany() {
    const apps = await queryGsi1<ApplicationItem>(this.db, 'APPS');
    const byCompany = new Map<string, CompanyApplicationDto[]>();
    for (const a of apps) {
      const rows = byCompany.get(a.companyId) ?? [];
      rows.push({ id: a.id, roleName: a.roleName, status: a.status });
      byCompany.set(a.companyId, rows);
    }
    return byCompany;
  }

  async delete(id: string) {
    const current = await this.getItem(id);
    if (!current) return;
    await this.db.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.db.table, Key: key.company(id) } },
          { Delete: { TableName: this.db.table, Key: key.companyName(current.name) } },
        ],
      }),
    );
  }
}
