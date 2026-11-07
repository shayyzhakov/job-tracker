import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TEST_DB_CONFIG } from '../test/db-config.js';

const SECRET = 'origin-secret-0123456789';

const event = (method: string, path: string, headers: Record<string, string>, body?: unknown) => ({
  version: '2.0',
  routeKey: '$default',
  rawPath: path,
  rawQueryString: '',
  headers: { host: 'abc.lambda-url.us-east-1.on.aws', ...headers },
  requestContext: {
    http: { method, path, protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
  },
  body: body === undefined ? undefined : JSON.stringify(body),
  isBase64Encoded: false,
});

describe('Lambda handler (Function URL events)', () => {
  let handler: (e: unknown, c: unknown) => Promise<APIGatewayProxyStructuredResultV2>;

  beforeAll(async () => {
    vi.stubEnv('DYNAMODB_TABLE', TEST_DB_CONFIG.table);
    vi.stubEnv('DYNAMODB_ENDPOINT', TEST_DB_CONFIG.endpoint ?? '');
    vi.stubEnv('ORIGIN_VERIFY_SECRET', SECRET);
    vi.stubEnv('MCP_ENABLED', 'true');
    vi.stubEnv('MCP_ALLOWED_HOSTS', 'abc.lambda-url.us-east-1.on.aws');
    vi.stubEnv('LOG_LEVEL', 'silent');
    ({ handler } = (await import('./lambda.js')) as never);
  });
  afterAll(() => vi.unstubAllEnvs());

  const call = (e: unknown) => handler(e, {});

  it('rejects requests that did not come through CloudFront', async () => {
    const res = await call(event('GET', '/health', {}));
    expect(res.statusCode).toBe(403);
  });

  it('serves /health when the origin secret is present', async () => {
    const res = await call(event('GET', '/health', { 'x-origin-verify': SECRET }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ status: 'ok', db: 'ok' });
  });

  it('passes POST bodies through to the MCP endpoint', async () => {
    const res = await call(
      event(
        'POST',
        '/mcp',
        {
          'x-origin-verify': SECRET,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      ),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('list_applications');
  });
});
