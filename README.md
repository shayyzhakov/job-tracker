# Job Tracker

Personal job-search tracker: applications, company details, contacts, interviews, status history, and an overview dashboard.

**Stack:** TypeScript · Node 24 · Fastify + Zod · DynamoDB (single table; DynamoDB Local in dev) · React + Vite + Mantine + TanStack Query · Vitest · Biome · pnpm workspaces

## Quick start

Prerequisites: Node 24 (`nvm use`), pnpm via corepack (`corepack enable`), and a Docker runtime (OrbStack or Docker Desktop).

```bash
pnpm install
cp .env.example .env
pnpm dev          # starts DynamoDB Local, creates the table, runs API (:3000) + web (:5173)
pnpm db:seed      # optional: wipe the dev table and load sample applications
```

Open http://localhost:5173.

### Fully containerized

```bash
docker compose --profile app up --build
```

Open http://localhost:8080. A single image runs the API, which also serves the built React app. Create the table first with `pnpm db:setup` (it needs DynamoDB Local running: `docker compose up -d dynamodb`).

## Scripts (root)

| Command                          | What it does                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                       | DynamoDB Local up → create table → API + web with hot reload                                                                                                                                           |
| `pnpm test`                      | All tests (shared, API unit + integration, web components)                                                                                                                                             |
| `pnpm test:watch`                | One Vitest watcher across all workspaces                                                                                                                                                               |
| `pnpm typecheck`                 | `tsc --noEmit` everywhere                                                                                                                                                                              |
| `pnpm check` / `pnpm check:fix`  | Biome lint + format                                                                                                                                                                                    |
| `pnpm db:setup`                  | Create the DynamoDB table and indexes if missing (idempotent)                                                                                                                                          |
| `pnpm db:seed`                   | Reset the dev table with sample data                                                                                                                                                                   |
| `pnpm db:migrate-notes`          | One-off: move legacy single-line interview notes into notes (idempotent; uses `DYNAMODB_TABLE` and the AWS credentials of the environment, so run it once per environment, including AWS after deploy) |
| `pnpm db:migrate-company-sizes`  | One-off: rename the stored company size `unicorn` to `scale_up` (idempotent; run once per environment, including AWS after deploy)                                                                     |

## Layout

```
apps/api         Fastify API
  src/app.ts       buildApp({ db }) — mounts the REST routes and the MCP endpoint
  src/services.ts  createServices(db) — repositories → services, shared by REST and MCP
  src/mcp/         MCP server: tools on top of the shared services, Streamable HTTP at /mcp
  src/auth/        Cognito access-token verification (/api/v1) and bearer parsing (shared by /api/v1 and /mcp)
  src/lambda.ts    AWS Lambda entry point (secrets from SSM); src/server.ts is the local one
  src/modules/     applications, companies, contacts, interviews, overview, opportunities, scout-criteria, integrations, health
  src/db/          DynamoDB client + key helpers, table definition, mappers, seed script
  test/            test DB helpers, in-memory fakes, factories
apps/web         React SPA
  src/api/         fetch client + TanStack Query hooks
  src/auth/        Cognito login gate (react-oidc-context)
  src/features/    overview/, applications/, suggestions/, scout/, integrations/ (pages + components + tests)
  test/            MSW server, fixtures, render helper
apps/worker      AI opportunity scout (daily job)
  src/run-scout.ts one scout pass: fetch → de-duplicate → screen → score → store
  src/sources/     ListingSource implementations (fixture only for now)
  src/scoring/     ClaudeScorer (Haiku 5.5) and an offline KeywordScorer
  fixtures/        sample Israel listings
packages/shared  Zod schemas, enums (statuses, company sizes) and API DTO types used by both sides
```

## Testing (TDD)

Features are built red → green → refactor:

- **Shared schemas:** unit tests for validation rules.
- **API services:** unit tests against in-memory fake repositories (`apps/api/test/fakes.ts`). Fast, no DB.
- **API routes + repositories:** integration tests via `app.inject()` against the `job-tracker-test` table in DynamoDB Local. Vitest global setup creates it and every test starts from an empty table.
- **Pure logic** such as the overview aggregation (`build-overview.ts`) is kept DB-free and unit-tested directly.
- **Web:** React Testing Library + user-event, with MSW mocking the API.

The API tests need DynamoDB Local running (`docker compose up -d dynamodb`).

### Data model

One table, keys `PK`/`SK`, two indexes (`GSI1`, `GSI2`). An application and its contacts, interviews, interview notes and status history share the partition `APP#<id>`, so loading an application is a single query. Applications, interviews and companies are listed through GSI1; suggestions per status (sorted by score) through GSI1 and the link from a suggestion to its application through GSI2. Unique company names and listing URLs are enforced with marker items written in the same transaction. Data is personal-scale, so list endpoints read an index and filter in memory. The table definition lives in `apps/api/src/db/table.ts` (dev/tests) and `infra/modules/dynamodb` (AWS) — keep them in sync.

## Domain notes

- **Status pipeline:** to apply → applied → HR screening → phone → technical → home assignment → onsite → final → offer → accepted. Closed outcomes are rejected, withdrawn and ghosted, and "active" means not closed.
- Status changes go through `PATCH /api/v1/applications/:id/status`, which records `status_history`. `appliedAt` is set automatically the first time an application leaves `to_apply`.
- Companies are deduplicated by case-insensitive name. The **Companies** page lists them with size, type and active / total applications, and adds, edits and deletes them (delete only when a company has no applications); editing a company changes it on all of its applications.
- **Salary** is expected monthly gross base salary in ILS.
- **Response rate** is the share of submitted applications that reached any stage beyond "applied". Rejections count as a response; ghosted and withdrawn don't.
- Weekly charts use Sunday-start weeks.

## Configuration

All configuration comes from environment variables (see `.env.example`): `DYNAMODB_TABLE`, `DYNAMODB_ENDPOINT` (DynamoDB Local only), `AWS_REGION`, `API_PORT`, `HOST`, `LOG_LEVEL`, `WEB_DIST_DIR` (serve the SPA from the API), `MCP_ENABLED` and `MCP_ALLOWED_HOSTS` (see below).

## MCP server

The API also serves an [MCP](https://modelcontextprotocol.io) endpoint at `/mcp` (stateless Streamable HTTP), so an MCP client such as Claude can read and change your applications, contacts, interviews, suggestions and scout settings. The tools call the same services and shared Zod schemas as the REST API, so status history, company de-duplication and validation work the same way.

Connect while the API is running (`pnpm dev`):

```bash
claude mcp add --transport http job-tracker http://localhost:3000/mcp
```

- **Claude Desktop:** its local config runs stdio servers, so bridge with `mcp-remote`: add `"job-tracker": { "command": "npx", "args": ["mcp-remote", "http://localhost:3000/mcp"] }` under `mcpServers` in `claude_desktop_config.json`.
- **Debugging:** `npx @modelcontextprotocol/inspector`, then connect to `http://localhost:3000/mcp` with the Streamable HTTP transport.

| Area            | Tools                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Applications    | `list_applications`, `get_application`, `create_application`, `update_application`, `change_application_status`, `delete_application` |
| Contacts        | `list_contacts`, `get_contact`, `add_contact`, `update_contact`, `remove_contact`                                                     |
| Interviews      | `schedule_interview`, `update_interview`, `remove_interview`                                                                          |
| Interview notes | `list_notes`, `add_note`, `update_note`, `remove_note`                                                                                |
| Companies       | `search_companies`, `list_companies`, `get_company`, `create_company`, `update_company`, `delete_company`                             |
| Overview        | `get_overview`                                                                                                                        |
| Suggestions     | `list_suggestions`, `add_suggestion`, `promote_suggestion`, `dismiss_suggestion`                                                      |
| Scout settings  | `get_scout_criteria`, `update_scout_criteria` (partial update)                                                                        |

Read-only tools carry `readOnlyHint` and deletes carry `destructiveHint`, so clients can ask before deleting. Errors (unknown id, invalid input, already promoted) come back as tool errors with a readable message.

**Locally there is no auth, so it's local-only.** On AWS the endpoint is protected by OAuth (Cognito access tokens with the `jobtracker/mcp` scope; clients register themselves via `POST /oauth/register`) and `MCP_ALLOWED_HOSTS=*`, which the app only accepts together with OAuth. Requests whose `Host` isn't in `MCP_ALLOWED_HOSTS` (default `localhost,127.0.0.1`) get a 403, which also blocks DNS-rebinding attacks from web pages. Set `MCP_ENABLED=false` to turn the endpoint off. Don't widen the host list for any deployment unless OAuth is configured.

## AI opportunity scout

A daily job (`apps/worker`) collects job listings, scores each one against your criteria with Claude, and stores the matches as **Suggestions**. On the Suggestions page you can **Add to applications** (which creates a `to_apply` application through `ApplicationsService.create`) or **Dismiss**.

- **Criteria** are edited on the **Scout settings** page (`GET`/`PUT /api/v1/scout/criteria`): roles, seniority, IC or management, locations, company sizes, excluded companies and a minimum match score. The scout does nothing until you save them once.
- **Pipeline:** fetch from every source → normalise and de-duplicate listing URLs (within the run and against the `opportunities` table) → drop excluded companies without a model call → score with Claude Haiku 5.5 (structured output: score, summary, reasons, management, seniority, inferred company size) → mark each listing `new` (a suggestion) or `filtered` (below the score, wrong track or wrong company size). Filtered listings are stored too, so a URL is never scored twice. A listing whose scoring failed isn't stored, so the next run retries it.
- **API:** `GET /api/v1/opportunities?status=new|filtered|dismissed|promoted`, `POST /api/v1/opportunities/:id/promote` (returns 201 with the new application), `POST /api/v1/opportunities/:id/dismiss`.
- **Sources:** only the `fixture` source (`apps/worker/fixtures/listings.json`) exists so far. To add one, implement `ListingSource` in `apps/worker/src/sources/`, add its name to `SOURCE_NAMES` in `config.ts` and its factory in `main.ts`.

Run it:

```bash
pnpm --filter @job-tracker/worker scout:once                      # one pass with Claude (needs ANTHROPIC_API_KEY)
SCOUT_SCORER=keyword pnpm --filter @job-tracker/worker scout:once # offline, no API key
pnpm --filter @job-tracker/worker dev                             # stay up and run on SCOUT_CRON
```

Worker configuration: `DYNAMODB_TABLE`, `DYNAMODB_ENDPOINT`, `ANTHROPIC_API_KEY`, `SCOUT_SCORER` (`claude` | `keyword`), `SCOUT_MODEL` (default `claude-haiku-5-5`), `SCOUT_SOURCES` (comma-separated), `SCOUT_FIXTURE_PATH`, `SCOUT_CRON` (default `0 7 * * *`), `SCOUT_TIMEZONE` (default `Asia/Jerusalem`), `LOG_LEVEL`. On AWS, an EventBridge schedule invokes the same scout pass as a Lambda (`apps/worker/src/handler.ts`, see `infra/`).

## Deploying to AWS

Infrastructure is code (OpenTofu) in [infra/](infra/README.md); `AWS_PROFILE=<profile> pnpm deploy:aws` runs tests, bundles the Lambda functions, applies the infrastructure and uploads the web app. See [infra/README.md](infra/README.md) for the architecture, one-time setup, costs and day-2 operations.

- **Shape:** CloudFront + private S3 (SPA) and a Lambda Function URL (API) on one HTTPS origin; DynamoDB; an EventBridge-scheduled Lambda for the scout; Cognito login. No VPC, no servers, roughly $0-1/month.
- **Auth:** with `COGNITO_USER_POOL_ID`/`COGNITO_CLIENT_ID` set, every `/api/v1` call needs a Cognito access token and the web app redirects to the hosted login (`VITE_COGNITO_*` at build time). Without them (local development) the app stays open. `/mcp` takes a Cognito OAuth access token with the MCP scope (needs `MCP_PUBLIC_URL` and `COGNITO_DOMAIN` too).
- **Database settings:** `DYNAMODB_TABLE` only; credentials come from the Lambda role (least-privilege policy on the table and its indexes). Secrets are read from SSM Parameter Store: any env var `SSM_<NAME>=<parameter name>` becomes `<NAME>` at cold start (`apps/api/src/ssm.ts`).
- **Bundles:** `scripts/build-lambda.sh` bundles `apps/api/src/lambda.ts` and `apps/worker/src/handler.ts` with esbuild into `dist-lambda/`. The Dockerfile is only for the local `--profile app` run.

## Roadmap

Technical design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the data model (ERD) in [docs/DATA-MODEL.md](docs/DATA-MODEL.md). Requirements live in [docs/PRD.md](docs/PRD.md) (an index of one file per requirement in `docs/requirements/`).

- Custom domain for the CloudFront URL (Route 53 + ACM in us-east-1).
- AI scout sources: real job boards (Greenhouse, Lever, Ashby and Comeet public board APIs for a company watchlist, or Claude web search). LinkedIn has no public API.
