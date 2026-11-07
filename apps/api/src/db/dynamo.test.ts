import { describe, expect, it } from 'vitest';
import { buildUpdate, resolveDbConfig } from './dynamo.js';

describe('resolveDbConfig', () => {
  it('requires a table name', () => {
    expect(() => resolveDbConfig({})).toThrow(/DYNAMODB_TABLE/);
  });

  it('defaults the region and leaves the endpoint unset on AWS', () => {
    expect(resolveDbConfig({ DYNAMODB_TABLE: 't' })).toEqual({
      table: 't',
      endpoint: undefined,
      region: 'us-east-1',
    });
  });

  it('reads the DynamoDB Local endpoint and region', () => {
    expect(
      resolveDbConfig({
        DYNAMODB_TABLE: 't',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
        AWS_REGION: 'eu-west-1',
      }),
    ).toEqual({ table: 't', endpoint: 'http://localhost:8000', region: 'eu-west-1' });
  });
});

describe('buildUpdate', () => {
  it('sets values (including null), skips undefined and removes attributes', () => {
    const u = buildUpdate({ a: 1, b: null, c: undefined }, ['d']);
    expect(u.UpdateExpression).toBe('SET #a0 = :v0, #a1 = :v1 REMOVE #a2');
    expect(u.ExpressionAttributeNames).toEqual({ '#a0': 'a', '#a1': 'b', '#a2': 'd' });
    expect(u.ExpressionAttributeValues).toEqual({ ':v0': 1, ':v1': null });
  });
});
