// Builds the app from validated config; shared by the long-running server (server.ts) and the Lambda handler (lambda.ts).
import { type AppDeps, buildApp } from './app.js';
import { createCognitoVerifier } from './auth/token-verifier.js';
import type { Config } from './config.js';
import type { Db } from './db/dynamo.js';
import { createCognitoClientRegistry } from './oauth/client-registry.js';

/** Custom scope of the Cognito resource server (infra/modules/auth) that grants access to /mcp. */
export const MCP_SCOPE = 'jobtracker/mcp';

export function buildAppFromConfig(config: Config, db: Db, overrides: Partial<AppDeps> = {}) {
  const userPoolId = config.COGNITO_USER_POOL_ID;
  return buildApp({
    db,
    webDistDir: config.WEB_DIST_DIR,
    mcp: config.MCP_ENABLED && {
      allowedHosts: config.MCP_ALLOWED_HOSTS,
      oauth:
        userPoolId && config.MCP_PUBLIC_URL && config.COGNITO_DOMAIN
          ? {
              // Any app client of the pool: each MCP client registers its own (see oauth/).
              verifier: createCognitoVerifier({ userPoolId, clientId: null }),
              publicUrl: config.MCP_PUBLIC_URL,
              scope: MCP_SCOPE,
              cognitoDomain: config.COGNITO_DOMAIN,
              registry: createCognitoClientRegistry({ userPoolId, scope: MCP_SCOPE }),
              redirectAllowlist: config.OAUTH_REDIRECT_ALLOWLIST,
            }
          : undefined,
    },
    gamification: config.GAMIFICATION_ENABLED,
    trustProxy: config.TRUST_PROXY,
    originVerify: config.ORIGIN_VERIFY_SECRET,
    auth:
      userPoolId && config.COGNITO_CLIENT_ID
        ? {
            verifier: createCognitoVerifier({ userPoolId, clientId: config.COGNITO_CLIENT_ID }),
          }
        : undefined,
    logger: {
      level: config.LOG_LEVEL,
      // Pretty logs locally; JSON in production (CloudWatch-friendly).
      ...(config.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
    ...overrides,
  });
}
