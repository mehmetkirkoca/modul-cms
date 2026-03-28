/**
 * Production migration runner.
 * Geliştirmede `db:push` kullan. Production'da bu scripti çalıştır.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './db/migrations' });
console.info('Migrations applied ✓');
await sql.end();
