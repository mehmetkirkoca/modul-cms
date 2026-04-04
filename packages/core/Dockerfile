FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ─── Deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc ./
COPY packages/sdk/package.json  ./packages/sdk/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/sdk  ./packages/sdk
COPY packages/core ./packages/core
RUN pnpm --filter @module-cms/sdk build
RUN pnpm --filter @module-cms/core build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache git docker-cli docker-cli-compose
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

# SDK (workspace symlink target)
COPY --from=builder /app/packages/sdk/dist         ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/package.json

# Core
COPY --from=builder /app/packages/core/dist         ./packages/core/dist
COPY --from=builder /app/packages/core/db           ./packages/core/db
COPY --from=builder /app/packages/core/proto        ./packages/core/dist/proto
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json

# plugins/ dizini runtime'da volume olarak mount edilir — image'a gömülmez

ENV NODE_ENV=production

COPY packages/core/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000 50051
CMD ["/entrypoint.sh"]
