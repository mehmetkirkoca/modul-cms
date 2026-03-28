FROM node:20-alpine AS base
RUN npm install -g pnpm@9.12.0
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/sdk ./packages/sdk
COPY packages/core ./packages/core
RUN pnpm --filter @module-cms/sdk build
RUN pnpm --filter @module-cms/core db:generate
RUN pnpm --filter @module-cms/core build

# ─── Production ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9.12.0
WORKDIR /app

COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/packages/core/package.json ./package.json
COPY --from=builder /app/packages/core/db ./db
COPY --from=builder /app/packages/core/proto ./proto
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

# DB migrations + start
CMD ["sh", "-c", "npx prisma migrate deploy --schema=db/schema.prisma && node dist/index.js"]

EXPOSE 3000 50051
