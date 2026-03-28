import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users, permissions, systemConfig } from './schema.js';

const DEFAULT_PERMISSIONS = [
  { role: 'editor',      resource: 'post',    action: 'create'   },
  { role: 'editor',      resource: 'post',    action: 'read'     },
  { role: 'editor',      resource: 'post',    action: 'update'   },
  { role: 'editor',      resource: 'post',    action: 'publish'  },
  { role: 'editor',      resource: 'post',    action: 'delete'   },
  { role: 'admin',       resource: 'post',    action: 'create'   },
  { role: 'admin',       resource: 'post',    action: 'read'     },
  { role: 'admin',       resource: 'post',    action: 'update'   },
  { role: 'admin',       resource: 'post',    action: 'publish'  },
  { role: 'admin',       resource: 'post',    action: 'delete'   },
  { role: 'admin',       resource: 'user',    action: 'create'   },
  { role: 'admin',       resource: 'user',    action: 'read'     },
  { role: 'admin',       resource: 'user',    action: 'update'   },
  { role: 'admin',       resource: 'plugin',  action: 'read'     },
  { role: 'admin',       resource: 'plugin',  action: 'settings' },
  { role: 'super_admin', resource: '*',       action: '*'        },
  { role: 'subscriber',  resource: 'post',    action: 'read'     },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db  = drizzle(sql);

  const password = await bcrypt.hash('admin123', 12);

  await db.insert(users).values({
    email:    'admin@modulecms.dev',
    name:     'Super Admin',
    password,
    role:     'super_admin',
  }).onConflictDoNothing();
  console.log('✓ Admin user: admin@modulecms.dev');

  await db.insert(permissions).values(DEFAULT_PERMISSIONS).onConflictDoNothing();
  console.log(`✓ ${DEFAULT_PERMISSIONS.length} permissions seeded`);

  await db.insert(systemConfig).values([
    { key: 'site_name', value: 'My moduleCMS Site' },
    { key: 'site_url',  value: 'http://localhost:3000' },
  ]).onConflictDoNothing();
  console.log('✓ System config defaults set');

  console.log('\nSeed completed!');
  console.log('Admin: admin@modulecms.dev / admin123');

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
