import { z } from 'zod';
import { DEFAULT_REDIRECT_ALLOWLIST } from './oauth/redirect-allowlist.js';

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    // The DynamoDB table/endpoint are resolved by db/dynamo.ts (DYNAMODB_TABLE, DYNAMODB_ENDPOINT).
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Directory of the built web app; when set, the API also serves the SPA. */
    WEB_DIST_DIR: z.string().optional(),
    /** Serve the MCP endpoint at /mcp. */
    MCP_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** Comma-separated hostnames allowed to call /mcp (local-only by default; `*` is allowed only with Cognito OAuth). */
    MCP_ALLOWED_HOSTS: z
      .string()
      .default('localhost,127.0.0.1')
      .transform((s) =>
        s
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      ),
    /** Public origin of the app (https://<cloudfront domain>); advertised in the OAuth discovery documents. */
    MCP_PUBLIC_URL: z
      .url()
      .transform((u) => u.replace(/\/+$/, ''))
      .optional(),
    /** Redirect URIs dynamically registered MCP clients may use: exact URIs, or `scheme://host:*` for any port. */
    OAUTH_REDIRECT_ALLOWLIST: z
      .string()
      .default(DEFAULT_REDIRECT_ALLOWLIST.join(','))
      .transform((s) =>
        s
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      ),
    /** Optional gamification side layer: serves GET /api/v1/progress. */
    GAMIFICATION_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** Lambda behind CloudFront: every request must carry `x-origin-verify: <this secret>` (added by CloudFront). */
    ORIGIN_VERIFY_SECRET: z.string().min(16).optional(),
    /** Cognito user pool; when both are set, every /api/v1 call needs a valid access token. */
    COGNITO_USER_POOL_ID: z.string().min(1).optional(),
    COGNITO_CLIENT_ID: z.string().min(1).optional(),
    /** Hostname of the Cognito hosted UI (<prefix>.auth.<region>.amazoncognito.com); the OAuth authorization server for /mcp. */
    COGNITO_DOMAIN: z.string().min(1).optional(),
    /** Behind CloudFront and an ALB: trust X-Forwarded-* headers. */
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .refine((c) => Boolean(c.COGNITO_USER_POOL_ID) === Boolean(c.COGNITO_CLIENT_ID), {
    message: 'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set together',
    path: ['COGNITO_CLIENT_ID'],
  })
  .refine(
    (c) => !(c.MCP_ENABLED && c.COGNITO_USER_POOL_ID) || (c.MCP_PUBLIC_URL && c.COGNITO_DOMAIN),
    {
      message: 'MCP_PUBLIC_URL and COGNITO_DOMAIN are required when Cognito protects /mcp',
      path: ['MCP_PUBLIC_URL'],
    },
  );

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
