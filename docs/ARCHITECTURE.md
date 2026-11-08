# Architecture

Technical overview of how Job Tracker is built and run. Product requirements are separate: see [PRD.md](PRD.md). Infrastructure setup and day-2 operations are in [infra/README.md](../infra/README.md); this document covers how the pieces fit together.

## 1. System context

```
Browser (React SPA) ──┐
                      ├─ HTTPS ─> CloudFront ─ /                  -> S3 (private, SPA build)
MCP client (Claude) ──┘                      └ /api /mcp /health  -> Lambda Function URL -> API Lambda ─┐
                                                                                                         ├─> DynamoDB (one table)
EventBridge Scheduler (daily) ─────────────────────────────────> Scout Lambda ──> Anthropic API ─────────┘
Cognito (hosted login, JWTs) · SSM Parameter Store (secrets) · CloudWatch Logs
```

Locally, the same code runs as a long-lived Fastify process (API on :3000), a Vite dev server (web on :5173, proxying to the API) and DynamoDB Local in Docker.

## 2. Repository layout

A pnpm workspace (Node 24, TypeScript, ESM) with four packages:

| Package           | Role                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/shared` | Zod schemas, enums, DTO types and scout helpers used by every other package.                          |
| `apps/api`        | Fastify REST API, MCP server, DynamoDB access, auth. Exports `@job-tracker/api/scout` for the worker. |
| `apps/web`        | React SPA (Vite, Mantine, TanStack Query, React Router, `react-oidc-context`).                        |
| `apps/worker`     | The AI scout: fetch listings, de-duplicate, score with Claude, store suggestions.                     |

Outside the workspace: `infra/` (OpenTofu), `scripts/` (build, deploy, init), `docker/` and `Dockerfile` (local images only), `.github/workflows/` (CI, dormant until a remote exists).

## 3. API (`apps/api`)

### Layering

```
routes (Fastify, Zod type provider)  ┐
MCP tools (defineTool)               ┴─> services ─> repositories ─> DynamoDB
```

- **`services.ts` is the composition root.** `createServices(db)` wires repositories into services once; both the REST routes and the MCP tools receive the same `Services` object, so business rules (status history, company de-duplication, applied-date handling, promote/dismiss conflicts) live in one place.
- **Modules** under `src/modules/`: `actions`, `applications`, `companies`, `contacts`, `interviews`, `notes`, `overview`, `opportunities`, `scout-criteria`, `integrations`, `health`. Contacts and interviews share a generic `ChildService`; `InterviewsService` extends it so scheduling an interview also advances the application's stage. `notes` has its own `NotesService` and routes (`/applications/:applicationId/interviews/:interviewId/notes`) because a note is keyed on the interview as well as the application; notes are read through the application detail (`interviewNotes`), not by their own `GET`.
- **Validation:** request and response schemas come from `packages/shared` via `fastify-type-provider-zod`. MCP handlers re-validate with the same schemas.
- **Errors:** services throw `NotFoundError` / `ConflictError`. The Fastify error handler maps them to 404 / 409 (validation to 400); the MCP layer maps them to tool errors with readable messages.
- **Repository interfaces** have a DynamoDB implementation and, for unit tests, an in-memory fake in `apps/api/test/fakes.ts`.

### Request pipeline

`buildApp(deps)` in `app.ts` assembles the Fastify instance:

1. Optional **origin check** hook: rejects any request without the `x-origin-verify` secret (so only CloudFront can reach the public Function URL).
2. **`/api/v1/*`**: scope with the Cognito auth hook (only when Cognito is configured), then the module routes.
3. **`/mcp`**: its own scope with a Host allow-list and OAuth (Cognito access token with the `jobtracker/mcp` scope) when Cognito is configured. Stateless Streamable HTTP: each POST builds a fresh `McpServer` and transport.
4. **`/health`**: always open.
5. Optional static serving of the built SPA (`WEB_DIST_DIR`), used only by the local Docker image.

`bootstrap.ts` turns validated config into `buildApp` dependencies. It is shared by both entry points:
- `server.ts`: long-running local server.
- `lambda.ts`: AWS Lambda handler via `@fastify/aws-lambda`. At cold start it resolves secrets from SSM (`ssm.ts`), creates the DynamoDB client and builds the app once; warm invocations reuse it.

### Configuration

Environment variables only, parsed and validated with Zod in `config.ts` (see `.env.example`). On AWS, secrets are stored in SSM Parameter Store and injected at cold start: an env var `SSM_<NAME>=<parameter name>` is replaced by `<NAME>=<decrypted value>`. Cognito variables must be set together or not at all.

### Authentication

- **REST:** the web app sends a Cognito access token as `Authorization: Bearer`. The API verifies signature (JWKS), issuer, expiry, `token_use=access` and client id with `aws-jwt-verify`. Without `COGNITO_*` variables (local development) the hook is not installed.
- **MCP:** standard MCP OAuth. Cognito is the authorization server and issues the tokens; the API adds what MCP clients need on top: `401` + `WWW-Authenticate` with `resource_metadata`, `/.well-known/oauth-protected-resource[/mcp]`, `/.well-known/oauth-authorization-server` (endpoints point at the Cognito hosted domain), and `POST /oauth/register` (RFC 7591 dynamic client registration, since Cognito has none). Registration creates a public Cognito app client (code + PKCE) for an allow-listed redirect URI (`OAUTH_REDIRECT_ALLOWLIST`), keeps at most 50 and deletes the oldest. `/mcp` accepts access tokens of any pool client that carries the `jobtracker/mcp` scope (the web client does not), so `/api/v1` keeps its single pinned client. `MCP_ALLOWED_HOSTS` guards the `Host` header (DNS-rebinding protection); `*` is only accepted together with OAuth.
- **Token lifetimes:** Cognito access and ID tokens last 60 minutes, refresh tokens 30 days. The SPA client is public (no secret); PKCE protects the code flow. Password policy: 8+ characters with upper case, lower case and a digit; recovery by verified email.

### MCP server

`src/mcp/` registers tools with `defineTool`, which wraps results as compact JSON, converts thrown errors into tool errors, and attaches `readOnlyHint` / `destructiveHint` annotations. Scope is tools only (no MCP resources or prompts). `update_scout_criteria` is a partial update (unsent fields are kept), unlike the REST `PUT`, which replaces everything. Claude Desktop connects through `mcp-remote` (it only runs stdio servers locally). `MCP_ENABLED=false` turns the endpoint off. Tools call `Services` directly; no logic is duplicated. Interview notes are exposed as `list_notes`, `add_note`, `update_note` and `remove_note` (destructive); `get_application` includes them. Tools are grouped in `tools/applications.ts`, `children.ts`, `suggestions.ts` and `misc.ts`.

## 4. Data layer

DynamoDB, single table, on-demand billing, keys `PK`/`SK`, two global secondary indexes (`GSI1`, `GSI2`, each with its own `PK`/`SK` attributes, projecting all attributes). Point-in-time recovery is enabled on AWS.

### Item types

The full entity-relationship diagram, column types, enums, relationships and access patterns are in [DATA-MODEL.md](DATA-MODEL.md).

| Item                     | PK                     | SK                        | Index keys                                                                                                       |
| ------------------------ | ---------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Application              | `APP#<id>`             | `META`                    | GSI1: `APPS` / `<updatedAt>#<id>` (list, newest first)                                                           |
| Contact                  | `APP#<id>`             | `CONTACT#<id>`            |                                                                                                                  |
| Interview                | `APP#<id>`             | `INTERVIEW#<id>`          | GSI1: `INTERVIEWS` / `<scheduledAt>#<id>` (upcoming interviews)                                                  |
| Interview note           | `APP#<id>`             | `NOTE#<interviewId>#<id>` | None. The `NOTE#<interviewId>#` prefix loads one interview's notes                                               |
| Status history entry     | `APP#<id>`             | `HISTORY#<at>#<id>`       | Carries `interviewId` when the step created or came from an interview (absent on older rows)                     |
| Company                  | `COMPANY#<id>`         | `META`                    | GSI1 (company listing and search)                                                                                |
| Company-name marker      | `CNAME#<lowercased>`   | `META`                    | Uniqueness only                                                                                                  |
| Opportunity (suggestion) | `OPP#<id>`             | `META`                    | GSI1: `OPPSTATUS#<status>` / zero-padded score + time (best first); GSI2: `APPOPP#<applicationId>` once promoted |
| Listing-URL marker       | `OPPURL#<sha256(url)>` | `META`                    | Uniqueness only                                                                                                  |
| Scout criteria           | `SCOUT`                | `CRITERIA`                |                                                                                                                  |

### Design notes

- **The action queue is derived, not stored.** `deriveActions` (`packages/shared/src/actions`) is a pure function of the active applications and all interviews; `GET /api/v1/actions` loads them and calls it. Only the user's inputs are stored on the application item: `replyBy`, `dueAt`, `nextStep`, `snoozedUntil`, `waitingOnThemAt`, `followUps` and `statusChangedAt` (rows without it fall back to `appliedAt` while applied, else `updatedAt`). A status change resets the hand-over, snooze and timeline. Interviews carry `timeUnknown` (placeholder time from a status change) and `debriefedAt`.

- **Item collections per application.** An application, its contacts, interviews, interview notes and history share the partition `APP#<id>`, so loading a full application is one `Query`.
- **Uniqueness via marker items.** Company names and listing URLs are made unique by writing a marker item in the same `TransactWriteItems` as the entity, guarded by `attribute_not_exists`.
- **Atomic multi-item changes** (create application with history, status change, promote suggestion) use transactions.
- **Scale assumption:** personal-scale data. List endpoints read an index and filter in memory instead of modelling every filter as a key.
- **Two definitions of one table.** `apps/api/src/db/table.ts` (DynamoDB Local for development and tests) and `infra/modules/dynamodb` (AWS) must stay in sync. `pnpm db:setup` creates the local table idempotently.
- **Key helpers and low-level operations** (query, batch get/delete, update-expression builder) live in `db/dynamo.ts`; entity-to-DTO mapping in `db/mappers.ts`.

## 5. Web app (`apps/web`)

- **Shell:** `main.tsx` mounts Mantine, TanStack Query, `AuthGate` and the React Router router. `Layout` provides the app shell and navigation.
- **Auth:** `AuthGate` wraps the app in `react-oidc-context` when `VITE_COGNITO_*` is set at build time (authorization-code flow with PKCE against the Cognito hosted UI). It redirects unauthenticated visitors to login and registers a token getter and a 401 handler used by the API client. With no config, the app renders without login.
- **Data access:** `api/client.ts` is a thin `fetch` wrapper (base path `/api/v1`, bearer token, `ApiError`). `api/hooks.ts` holds the TanStack Query hooks; mutations invalidate the affected queries.
- **Features:** `features/` has one folder per area (`overview`, `applications`, `suggestions`, `scout`, `integrations`) with pages, components and tests.
- **Same origin in production.** CloudFront serves the SPA and proxies `/api`, so there is no CORS; in development Vite proxies `/api`, `/health` and `/mcp` to the local API. `VITE_API_URL` overrides the base for a separate API host.
- **Forms** use Zod schemas from `packages/shared` through `lib/zod-form.ts`.

### Web: gamification layer

An optional side layer: XP, levels, streaks, achievements, quests and the pipeline view (requirement [08](requirements/08-gamification.md)). The rule is that **core works, compiles and is tested without it**, and the layer can be plugged or unplugged without editing core logic.

**Where it lives (delete these to remove it)**

| Part   | Location                              | Role                                                                                                                                                           |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared | `packages/shared/src/gamification/`   | Pure scoring: `xpFromProgress`, `levelFromXp`, `computeStreak`, quests, achievements, plus the `ProgressDto` contract. No I/O.                                 |
| API    | `apps/api/src/modules/gamification/`  | `GET /api/v1/progress`: read-only facts (daily activity in Israel time, stage counts, interview types, contacts). Registered only when `GAMIFICATION_ENABLED`. |
| Web    | `apps/web/src/features/gamification/` | UI, effects, celebrations, the runtime switch, styles (`gm-` prefix).                                                                                          |

**How it plugs into core.** Core exposes two generic extension points and knows nothing about the layer:

- `lib/app-events.ts`: a typed event bus. Core mutations in `api/hooks.ts` emit `application.created`, `application.deleted`, `status.changed`, `interview.created` and `contact.created` after a successful write. A throwing subscriber cannot break the write.
- `lib/extensions.tsx`: named slots (`header.right`, `overview.top`, `applications.views`, `application.detail.top`) rendered with `<Slot name=…/>`, and `registerRoute` for extra routes. An empty slot renders nothing.
- `main.tsx` calls `registerGamification()` once, before the router is created. That line is the only import of the layer from core. Removing it unplugs the layer; `registerGamification()` also returns a function that undoes the registration (used in tests).

**Data flow.** The API returns facts; the web layer scores them. After a core event, the layer refetches `['gamification','progress']`, compares before and after, and fires rewards for the difference. Progress is derived and never persisted, so there is no migration and no state to repair when the layer is removed.

**Rules for changing it** (enforced by tests, see below)

1. Core never imports the layer (except the one line in `main.tsx`) and never mentions it by name. New hooks for the layer must be generic events or slots.
2. The layer reads core only through `api/`, `components/` and `lib/`, and never imports another feature. It must not write data (no database writes on the API side).
3. All layer CSS is scoped to `.gm-…`. Layer effects must respect reduced motion.
4. Adding an application status: add it to a pipeline group in `groups.ts` (a test fails otherwise) and, if it should earn XP, to `XP_RULES.stage`.
5. Adding a rule, achievement or quest: edit `shared/gamification/engine.ts` only; keep ids unique and never rename an existing achievement id (it is stored as "already celebrated" in browsers).
6. A new core write that should be rewarded must emit an event; add it to `AppEvent` and to `api/hooks.events.test.tsx`.

**Tests that guard it**

| Test                                              | Protects against                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `web/src/architecture.test.ts`                    | Core importing or naming the layer, the layer reaching into other features, unscoped CSS, a second plug point. |
| `api/src/architecture.test.ts`                    | The module being wired in anywhere but `app.ts`, database writes, cross-module imports.                        |
| `web/src/api/hooks.events.test.tsx`               | A core mutation silently stopping to emit its event (which would silently disable rewards).                    |
| `web/src/features/gamification/plugging.test.tsx` | Core pages changing when the layer is unplugged or switched off; slots not unplugging cleanly.                 |
| `web/src/features/gamification/groups.test.ts`    | A new status missing from the pipeline.                                                                        |
| `shared/src/gamification/*.test.ts`               | Scoring bugs: day boundaries, streaks, XP and level monotonicity, duplicate ids.                               |
| `api/src/modules/gamification/*.test.ts`          | The progress read-model, and `/progress` existing only when enabled.                                           |

## 6. Scout worker (`apps/worker`)

One run (`run-scout.ts`):

1. Load criteria; if never saved, skip the run.
2. Fetch from each `ListingSource` (a failing source does not stop the run). Only a `fixture` source exists today.
3. Normalise URLs, de-duplicate within the run and against stored listings, and drop excluded companies without a model call.
4. Score the rest with a `ListingScorer` (bounded concurrency): `ClaudeScorer` (Claude Haiku 5.5, structured output) or an offline `KeywordScorer`.
5. Store each listing as `new` (a suggestion) or `filtered`. Failed scores are not stored, so the next run retries them.

`ListingSource`, `ListingScorer` and the repositories are injected into `runScout`, so it is tested without network or DynamoDB. The worker reuses the API's repositories through the `@job-tracker/api/scout` export.

Entry points: `handler.ts` (Lambda, invoked by EventBridge Scheduler; reads secrets from SSM) and `main.ts` (local: `--once`, or a `node-cron` schedule).

## 7. AWS deployment

Defined with OpenTofu in `infra/` (single `prod` environment; remote state in S3, client-side encrypted with a KMS key created by `infra/bootstrap`).

| Module            | Provides                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dynamodb`        | The table, its indexes, PITR, and the least-privilege policy for the Lambdas.                                                                                                                                                 |
| `lambda-function` | Role, log group and function (arm64, Node 24) from a zip of `dist-lambda/`; optionally a Function URL.                                                                                                                        |
| `web`             | Private S3 bucket and CloudFront distribution: S3 origin for the SPA (SPA fallback via a CloudFront Function), Function URL origin for `/api`, `/mcp`, `/health`, `/.well-known/*`, `/oauth/*` with the origin-verify header. |
| `auth`            | Cognito user pool (admin-created user, optional TOTP MFA), SPA client (code + PKCE), hosted login domain, and the `jobtracker/mcp` resource-server scope for MCP clients.                                                     |
| `scout`           | EventBridge Scheduler rule that invokes the scout Lambda daily at 07:00 Asia/Jerusalem.                                                                                                                                       |
| `budget`          | Monthly cost alert.                                                                                                                                                                                                           |

`envs/prod` wires the modules together and creates the SSM parameters (origin-verify secret, Cognito identifiers and domain, the app's public URL, and a placeholder for the Anthropic API key that is set by hand) and grants the API Lambda permission to create, list and delete Cognito app clients for MCP client registration.

**Why this shape:** no VPC, NAT, load balancer or servers, so everything sits in always-free allowances (about $0-1/month). A single CloudFront origin avoids CORS and needs no custom domain. The Function URL is public but only answers requests carrying CloudFront's secret header; OAC was rejected because it requires clients to sign POST bodies.

### Build and deploy pipeline

1. `scripts/build-lambda.sh` bundles `apps/api/src/lambda.ts` and `apps/worker/src/handler.ts` with esbuild into `dist-lambda/{api,scout}/index.mjs` (single minified ESM file each).
2. `scripts/deploy.sh` runs checks and tests, builds the Lambdas and the SPA, runs `tofu plan` (confirmation before apply), applies, uploads the SPA to S3, invalidates CloudFront and smoke-tests.
3. `.github/workflows/` mirrors this (plan on pull requests, deploy on `main` behind an approval) but is dormant until the project has a GitHub remote and the OIDC deploy role exists.

## 8. Testing strategy

| Layer                     | Tooling                                        | What it uses                                                                                              |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Shared schemas            | Vitest                                         | Pure unit tests.                                                                                          |
| Services, scout logic     | Vitest                                         | In-memory fake repositories; no DB, no network.                                                           |
| Pure logic (overview)     | Vitest                                         | `build-overview` kept free of I/O and tested directly.                                                    |
| Routes, repositories, MCP | Vitest + `app.inject()` / MCP client           | DynamoDB Local test table (`job-tracker-test`), emptied before each test; created by Vitest global setup. |
| Web                       | Vitest, React Testing Library, user-event, MSW | API mocked at the network edge.                                                                           |
| Lambda entry, SSM, config | Vitest                                         | Focused unit tests (`lambda.test.ts`, `ssm.test.ts`, `config.test.ts`).                                   |

Development is test-first. Quality gates: `pnpm test` (workspace packages run sequentially because they share one DynamoDB Local), `pnpm typecheck` and `pnpm check` (Biome lint and format). API integration tests need DynamoDB Local (`docker compose up -d dynamodb`).

## 9. Security model

| Boundary         | Control                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet to API  | CloudFront only: Function URL requests need the `x-origin-verify` secret.                                                                                                     |
| Web/REST caller  | Cognito access token verified on every `/api/v1` call; self sign-up disabled.                                                                                                 |
| MCP caller       | Cognito OAuth access token with the `jobtracker/mcp` scope plus Host allow-list.                                                                                              |
| MCP registration | Unauthenticated by design (RFC 7591); redirect-URI allow-list, 50-client cap with pruning, per-instance rate limit. A registered client is useless without the owner's login. |
| Lambda to data   | Execution role limited to the table and its indexes, and to read `/job-tracker/*` SSM parameters.                                                                             |
| Secrets          | SSM Parameter Store (SecureString); never in git or in the bundle.                                                                                                            |
| Not implemented  | WAF and global rate limiting (single-user trade-off).                                                                                                                         |

## 10. Key decisions

| Decision                                           | Reason                                                                                                                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lambda + DynamoDB instead of containers + RDS      | Idle cost near zero, nothing to patch or scale; data is small and access patterns known.                                                                                                                                                            |
| One Fastify app for Lambda and local               | Same code path everywhere; the Lambda adapter is a few lines.                                                                                                                                                                                       |
| Shared Zod schemas across API, MCP, web and worker | One definition of every input and DTO; MCP and REST cannot drift.                                                                                                                                                                                   |
| Services shared by REST and MCP                    | Business rules are implemented once.                                                                                                                                                                                                                |
| Stateless MCP over Streamable HTTP                 | Fits Lambda (no sessions to store).                                                                                                                                                                                                                 |
| Cognito as MCP authorization server + DCR route    | Cognito has no dynamic client registration; a small route in the API creates app clients, so clients need no manual setup and no extra AWS service or Lambda.                                                                                       |
| Discovery by well-known URLs, not the 401 header   | Lambda Function URLs rename `WWW-Authenticate`; a CloudFront Function cannot restore it on the origin's 401 (tried and removed). Lambda@Edge is the fallback if a client needs the header.                                                          |
| Interview delete cascades notes non-atomically     | A transaction caps at 100 items and notes are unbounded. The interview is deleted first, then its notes are batch-deleted; leftovers are harmless because reads drop notes whose interview is gone.                                                 |
| Interview notes migrated by a one-off script       | `pnpm db:migrate-notes` (`src/db/migrate-interview-notes.ts`) turns the old `INTERVIEW.notes` text into one note per interview (note id = interview id, written only if absent) and removes the attribute; idempotent and run once per environment. |
| OpenTofu rather than SAM / CDK / Serverless        | One source of truth for all infrastructure.                                                                                                                                                                                                         |
| Single DynamoDB table with marker items            | Cheap transactional uniqueness and one-query aggregates without a relational DB.                                                                                                                                                                    |
