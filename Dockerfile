# syntax=docker/dockerfile:1
# Single image: Fastify API that also serves the built React app.
# Runs locally via `docker compose --profile app up`, and unchanged on AWS (ECS Fargate / App Runner).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @job-tracker/shared build \
 && pnpm --filter @job-tracker/api build \
 && pnpm --filter @job-tracker/web build
# Self-contained production bundle of the API (prod deps only, workspace packages injected).
RUN pnpm --filter @job-tracker/api deploy --prod /out

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
