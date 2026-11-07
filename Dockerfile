# syntax=docker/dockerfile:1
# Targets:
#   runtime (default)  Fastify API that can also serve the built React app (`docker compose --profile app up`).
#   worker             the AI scout job (`node dist/main.js --once`), for running the scout locally.
# These images are for local use only: on AWS the API and scout run as Lambda functions (scripts/build-lambda.sh)
# and the SPA is served from S3 + CloudFront.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
COPY apps/worker apps/worker
RUN pnpm --filter @job-tracker/shared build \
 && pnpm --filter @job-tracker/api build \
 && pnpm --filter @job-tracker/worker build \
 && pnpm --filter @job-tracker/web build
# Self-contained production bundle of the API (prod deps only, workspace packages injected).
RUN pnpm --filter @job-tracker/api deploy --prod /out \
 && pnpm --filter @job-tracker/worker deploy --prod /out-worker

FROM node:24-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out-worker ./
USER node
# One scout pass, then exit (EventBridge Scheduler starts the task daily).
CMD ["node", "--conditions=production", "dist/main.js", "--once"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    API_PORT=3000 \
    WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app
COPY --from=build /out ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY docker/entrypoint.sh /entrypoint.sh
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
