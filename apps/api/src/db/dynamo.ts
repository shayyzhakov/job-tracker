import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type BatchGetCommandOutput,
  BatchWriteCommand,
  type BatchWriteCommandInput,
  type BatchWriteCommandOutput,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  type QueryCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

export interface DbConfig {
  table: string;
  /** Set for DynamoDB Local (docker compose); leave unset on AWS. */
  endpoint?: string;
  region: string;
}

const EnvSchema = z.object({
  DYNAMODB_TABLE: z.string().min(1, 'DYNAMODB_TABLE is required'),
  DYNAMODB_ENDPOINT: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).default('us-east-1'),
});

/** Table, endpoint and region from env. Credentials come from the SDK's default chain (task role on AWS). */
export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const e = EnvSchema.parse(env);
  return { table: e.DYNAMODB_TABLE, endpoint: e.DYNAMODB_ENDPOINT, region: e.AWS_REGION };
}

export interface Db {
  doc: DynamoDBDocumentClient;
  client: DynamoDBClient;
  table: string;
}

export function createDb(config: DbConfig = resolveDbConfig()) {
  const client = new DynamoDBClient({
    region: config.region,
    ...(config.endpoint && {
      endpoint: config.endpoint,
      // DynamoDB Local ignores credentials but the SDK insists on having some.
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }),
  });
  const doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const db: Db = { doc, client, table: config.table };
  return { db, close: async () => doc.destroy() };
}

// ---- key helpers (single-table design; see infra/modules/dynamodb) ----

export const key = {
  company: (id: string) => ({ PK: `COMPANY#${id}`, SK: 'META' }),
  companyName: (name: string) => ({ PK: `CNAME#${name.toLowerCase()}`, SK: 'META' }),
  app: (id: string) => ({ PK: `APP#${id}`, SK: 'META' }),
  /** The person (shared across applications). */
  contact: (id: string) => ({ PK: `CONTACT#${id}`, SK: 'META' }),
  /** Attaches the person to one application. */
  contactLink: (appId: string, id: string) => ({ PK: `APP#${appId}`, SK: `CONTACT#${id}` }),
  interview: (appId: string, id: string) => ({ PK: `APP#${appId}`, SK: `INTERVIEW#${id}` }),
  note: (appId: string, interviewId: string, id: string) => ({
    PK: `APP#${appId}`,
    SK: `NOTE#${interviewId}#${id}`,
  }),
  history: (appId: string, at: string, id: string) => ({
    PK: `APP#${appId}`,
    SK: `HISTORY#${at}#${id}`,
  }),
  opportunity: (id: string) => ({ PK: `OPP#${id}`, SK: 'META' }),
  opportunityUrl: (url: string) => ({ PK: `OPPURL#${url}`, SK: 'META' }),
  scoutCriteria: () => ({ PK: 'SCOUT', SK: 'CRITERIA' }),
};

export const GSI1 = 'GSI1';
export const GSI2 = 'GSI2';

export const iso = (d: Date) => d.toISOString();
export const isoOrNull = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const dateOrNull = (s: string | null | undefined) => (s ? new Date(s) : null);

type Item = Record<string, unknown>;
type WriteRequest = NonNullable<BatchWriteCommandInput['RequestItems']>[string][number];

/** Runs a query and follows pagination until every item is read. */
export async function queryAll<T = Item>(
  db: Db,
  input: Omit<QueryCommandInput, 'TableName'>,
): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await db.doc.send(
      new QueryCommand({ ...input, TableName: db.table, ExclusiveStartKey }),
    );
    items.push(...((res.Items ?? []) as T[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
    // A Limit means the caller wants at most that many items.
    if (input.Limit && items.length >= input.Limit) return items.slice(0, input.Limit);
  } while (ExclusiveStartKey);
  return items;
}

export const queryGsi1 = <T = Item>(
  db: Db,
  pk: string,
  opts: {
    skCondition?: string;
    values?: Record<string, unknown>;
    desc?: boolean;
    limit?: number;
  } = {},
) =>
  queryAll<T>(db, {
    IndexName: GSI1,
    KeyConditionExpression: `GSI1PK = :pk${opts.skCondition ? ` AND ${opts.skCondition}` : ''}`,
    ExpressionAttributeValues: { ':pk': pk, ...opts.values },
    ScanIndexForward: !opts.desc,
    Limit: opts.limit,
  });

export const queryPartition = <T = Item>(db: Db, pk: string, skPrefix?: string) =>
  queryAll<T>(db, {
    KeyConditionExpression: skPrefix ? 'PK = :pk AND begins_with(SK, :sk)' : 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk, ...(skPrefix && { ':sk': skPrefix }) },
  });

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** BatchGet by key (deduplicated), retrying unprocessed keys. */
export async function batchGet<T = Item>(db: Db, keys: { PK: string; SK: string }[]): Promise<T[]> {
  const unique = [...new Map(keys.map((k) => [`${k.PK}|${k.SK}`, k])).values()];
  const items: T[] = [];
  for (const part of chunk(unique, 100)) {
    let pending: Record<string, unknown>[] | undefined = part;
    while (pending && pending.length > 0) {
      const res: BatchGetCommandOutput = await db.doc.send(
        new BatchGetCommand({ RequestItems: { [db.table]: { Keys: pending } } }),
      );
      items.push(...((res.Responses?.[db.table] ?? []) as T[]));
      pending = res.UnprocessedKeys?.[db.table]?.Keys;
    }
  }
  return items;
}

/** BatchWrite deletes, retrying unprocessed keys. */
export async function batchDelete(db: Db, keys: { PK: string; SK: string }[]) {
  for (const part of chunk(keys, 25)) {
    let pending: WriteRequest[] | undefined = part.map((Key) => ({ DeleteRequest: { Key } }));
    while (pending && pending.length > 0) {
      const res: BatchWriteCommandOutput = await db.doc.send(
        new BatchWriteCommand({ RequestItems: { [db.table]: pending } }),
      );
      pending = res.UnprocessedItems?.[db.table];
    }
  }
}

/** Builds an UpdateItem expression: `set` values (null is stored as NULL) and attributes to `remove`. */
export function buildUpdate(set: Item, remove: string[] = []) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets: string[] = [];
  let i = 0;
  for (const [attr, value] of Object.entries(set)) {
    if (value === undefined) continue;
    names[`#a${i}`] = attr;
    values[`:v${i}`] = value;
    sets.push(`#a${i} = :v${i}`);
    i++;
  }
  const removes = remove.map((attr) => {
    names[`#a${i}`] = attr;
    return `#a${i++}`;
  });
  const expression = [
    sets.length > 0 && `SET ${sets.join(', ')}`,
    removes.length > 0 && `REMOVE ${removes.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    UpdateExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
  };
}

/**
 * Updates an existing item and returns its new attributes, or null when it doesn't exist.
 * An empty `set` just reads the item.
 */
export async function updateExisting<T = Item>(
  db: Db,
  Key: { PK: string; SK: string },
  set: Item,
  remove: string[] = [],
): Promise<T | null> {
  if (Object.keys(set).length === 0 && remove.length === 0) {
    const res = await db.doc.send(new GetCommand({ TableName: db.table, Key }));
    return (res.Item as T | undefined) ?? null;
  }
  try {
    const res = await db.doc.send(
      new UpdateCommand({
        TableName: db.table,
        Key,
        ConditionExpression: 'attribute_exists(PK)',
        ...buildUpdate(set, remove),
        ReturnValues: 'ALL_NEW',
      }),
    );
    return res.Attributes as T;
  } catch (err) {
    if (isConditionFailed(err)) return null;
    throw err;
  }
}

export const isConditionFailed = (err: unknown) =>
  (err as { name?: string })?.name === 'ConditionalCheckFailedException';

export const isTransactionCancelled = (err: unknown) =>
  (err as { name?: string })?.name === 'TransactionCanceledException';
