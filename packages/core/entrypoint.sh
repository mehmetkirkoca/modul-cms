#!/bin/sh
set -e

echo "[startup] Running core DB migrations..."
cd /app/packages/core
npx tsx db/migrate.ts

echo "[startup] Starting server..."
cd /app/packages/core
exec node dist/src/index.js
