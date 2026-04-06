FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ─── Deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc ./
COPY packages/sdk/package.json   ./packages/sdk/
COPY packages/admin/package.json ./packages/admin/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/sdk   ./packages/sdk
COPY packages/admin ./packages/admin
RUN pnpm --filter @module-cms/sdk build
RUN pnpm --filter @module-cms/admin build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner
COPY packages/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/admin/dist /usr/share/nginx/html
EXPOSE 80
