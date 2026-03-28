import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const url = process.env.CONTENT_DATABASE_URL;
if (!url) throw new Error('[content-plugin] CONTENT_DATABASE_URL is not set');

const sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });

export const db = drizzle(sql, { schema });
export { sql };
