import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema:    './db/schema.ts',
  out:       './db/migrations',
  dialect:   'postgresql',
  dbCredentials: {
    url: process.env.CONTENT_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/content_db',
  },
});
