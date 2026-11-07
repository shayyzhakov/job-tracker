import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  InvalidParameterException,
  ListUserPoolClientsCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface RegisteredClient {
  clientId: string;
}

/** Thrown when Cognito refuses the client metadata (e.g. a callback URL it does not accept). */
export class InvalidClientMetadataError extends Error {}

/** Where dynamically registered OAuth clients live. Cognito in production, an in-memory fake in tests. */
export interface ClientRegistry {
  create(input: { displayName: string; redirectUris: string[] }): Promise<RegisteredClient>;
  /** Dynamically registered clients only, oldest first. */
  list(): Promise<RegisteredClient[]>;
  remove(clientId: string): Promise<void>;
}

/** Prefix that marks app clients created by dynamic registration; the rest of the name starts with the epoch ms. */
export const DCR_CLIENT_PREFIX = 'mcp-dcr-';

const sanitize = (name: string) =>
  name
    .replace(/[^\w\s+=,.@-]/g, '')
    .trim()
    .slice(0, 60);

/** Registers each MCP client as a public Cognito app client (authorization code + PKCE, no secret). */
export function createCognitoClientRegistry(opts: {
  userPoolId: string;
  scope: string;
  client?: Pick<CognitoIdentityProviderClient, 'send'>;
}): ClientRegistry {
  const cognito = opts.client ?? new CognitoIdentityProviderClient({});
  return {
    async create({ displayName, redirectUris }) {
      try {
        const res = await cognito.send(
          new CreateUserPoolClientCommand({
            UserPoolId: opts.userPoolId,
            ClientName: `${DCR_CLIENT_PREFIX}${Date.now()}-${sanitize(displayName) || 'client'}`,
            GenerateSecret: false,
            AllowedOAuthFlowsUserPoolClient: true,
            AllowedOAuthFlows: ['code'],
            AllowedOAuthScopes: ['openid', opts.scope],
            CallbackURLs: redirectUris,
            SupportedIdentityProviders: ['COGNITO'],
            ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
            PreventUserExistenceErrors: 'ENABLED',
            EnableTokenRevocation: true,
            AccessTokenValidity: 60,
            IdTokenValidity: 60,
            RefreshTokenValidity: 30,
            TokenValidityUnits: {
              AccessToken: 'minutes',
              IdToken: 'minutes',
              RefreshToken: 'days',
            },
          }),
        );
        const clientId = res.UserPoolClient?.ClientId;
        if (!clientId) throw new Error('Cognito returned no client id');
        return { clientId };
      } catch (err) {
        if (err instanceof InvalidParameterException) {
          throw new InvalidClientMetadataError(err.message);
        }
        throw err;
      }
    },

    async list() {
      const found: { clientId: string; name: string }[] = [];
      let next: string | undefined;
      do {
        const res = await cognito.send(
          new ListUserPoolClientsCommand({
            UserPoolId: opts.userPoolId,
            MaxResults: 60,
            NextToken: next,
          }),
        );
        for (const c of res.UserPoolClients ?? []) {
          if (c.ClientId && c.ClientName?.startsWith(DCR_CLIENT_PREFIX)) {
            found.push({ clientId: c.ClientId, name: c.ClientName });
          }
        }
        next = res.NextToken;
      } while (next);
      // Names embed the creation time in epoch ms right after the prefix, so sorting by it is oldest first.
      const created = (name: string) => Number(name.slice(DCR_CLIENT_PREFIX.length).split('-')[0]);
      return found
        .sort((a, b) => created(a.name) - created(b.name))
        .map((c) => ({ clientId: c.clientId }));
    },

    async remove(clientId) {
      await cognito.send(
        new DeleteUserPoolClientCommand({ UserPoolId: opts.userPoolId, ClientId: clientId }),
      );
    },
  };
}
