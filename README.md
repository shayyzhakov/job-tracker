# Job Tracker

Personal job-search tracker: applications, company details, contacts, interviews, status history, and an overview dashboard.

**Stack:** TypeScript · Node 24 · Fastify + Zod · Drizzle ORM · PostgreSQL 17 · React + Vite + Mantine + TanStack Query · Vitest · Biome · pnpm workspaces

## Quick start

Prerequisites: Node 24 (`nvm use`), pnpm via corepack (`corepack enable`), and a Docker runtime (OrbStack or Docker Desktop).

```bash
pnpm install
cp .env.example .env
pnpm dev          # starts Postgres, applies migrations, runs API (:3000) + web (:5173)
pnpm db:seed      # optional: wipe dev DB and load sample applications
```

Open http://localhost:5173.

### Fully containerized

```bash
docker compose --profile app up --build
```

Open http://localhost:8080. A single image runs the API, which also serves the built React app, and it applies migrations on start.

## Scripts (root)

| Command                         | What it does                                                       |
| ------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                      | Postgres up → migrate → API + web with hot reload                  |
| `pnpm test`                     | All tests (shared, API unit + integration, web components)         |
| `pnpm test:watch`               | One Vitest watcher across all workspaces                           |
| `pnpm typecheck`                | `tsc --noEmit` everywhere                                          |
| `pnpm check` / `pnpm check:fix` | Biome lint + format                                                |
| `pnpm db:generate`              | Generate a SQL migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate`               | Apply migrations to `DATABASE_URL`                                 |
| `pnpm db:seed`                  | Reset dev DB with sample data                                      |

## Layout

```
apps/api         Fastify API
  src/app.ts       buildApp({ db }) — composition root (repos → services → routes)
  src/modules/     applications, companies, contacts, interviews, overview, health
  src/db/          Drizzle schema, SQL migrations, migrate + seed scripts
  test/            test DB helpers, in-memory fakes, factories
apps/web         React SPA
  src/api/         fetch client + TanStack Query hooks
  src/features/    overview/, applications/ (pages + components + tests)
  test/            MSW server, fixtures, render helper
packages/shared  Zod schemas, enums (statuses, company sizes) and API DTO types used by both sides
```

## Testing (TDD)

Features are built red → green → refactor:

- **Shared schemas:** unit tests for validation rules.
- **API services:** unit tests against in-memory fake repositories (`apps/api/test/fakes.ts`). Fast, no DB.
- **API routes + repositories:** integration tests via `app.inject()` against the `jobtracker_test` database. It's created automatically by `docker/postgres/init-test-db.sql`, migrated by Vitest global setup, and truncated before each test.
- **Pure logic** such as the overview aggregation (`build-overview.ts`) is kept DB-free and unit-tested directly.
- **Web:** React Testing Library + user-event, with MSW mocking the API.

The API tests need Postgres running (`docker compose up -d db`).

## Domain notes

- **Status pipeline:** to apply → applied → HR screening → phone → technical → home assignment → onsite → final → offer → accepted. Closed outcomes are rejected, withdrawn and ghosted, and "active" means not closed.
- Status changes go through `PATCH /api/v1/applications/:id/status`, which records `status_history`. `appliedAt` is set automatically the first time an application leaves `to_apply`.
- Companies are deduplicated by case-insensitive name.
- **Salary** is expected monthly gross base salary in ILS.
- **Response rate** is the share of submitted applications that reached any stage beyond "applied". Rejections count as a response; ghosted and withdrawn don't.
- Weekly charts use Sunday-start weeks.

## Configuration

All configuration comes from environment variables (see `.env.example`): `DATABASE_URL`, `API_PORT`, `HOST`, `LOG_LEVEL`, `WEB_DIST_DIR` (serve the SPA from the API), and `MIGRATE_ON_START` (container only).

## Moving to AWS

Nothing in the app is local-only, so the path is mostly infrastructure:

1. **Database:** RDS for PostgreSQL. Point `DATABASE_URL` at it, using Secrets Manager for credentials.
2. **App:** push the Docker image to ECR and run it on ECS Fargate (behind an ALB, health check `/health`) or App Runner.
3. **Migrations:** run `node --conditions=production dist/db/migrate.js` as a one-off ECS task per deploy, rather than `MIGRATE_ON_START`.
4. **Logs:** production logs are JSON (pino), ready for CloudWatch.
5. **Optional:** host `apps/web/dist` on S3 + CloudFront and set `VITE_API_URL` at build time.
6. **Before exposing it publicly, add auth** (for example Cognito plus a Fastify auth hook) and a `user_id` column.

## Roadmap

- AI opportunity scout: a daily background job (`apps/worker`, local cron → EventBridge later) that finds new listings, stores them in an `opportunities` table, and lets you promote one into an application.
