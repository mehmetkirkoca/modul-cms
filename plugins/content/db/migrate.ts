import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.info('[content-plugin] Running migrations...');
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
  console.info('[content-plugin] Migrations complete');
  await sql.end();
}

main().catch((err) => {
  console.error('[content-plugin] Migration failed:', err);
  process.exit(1);
});
