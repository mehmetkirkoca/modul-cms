import { and, eq } from 'drizzle-orm';
import { db } from '../client.js';
import { permissions, users } from '../../../db/schema.js';

export const permissionRepository = {
  async check(userId: string, resource: string, action: string): Promise<boolean> {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return false;

    const { role } = user;

    // super_admin wildcard
    const [wildcard] = await db.select().from(permissions)
      .where(and(eq(permissions.role, role), eq(permissions.resource, '*'), eq(permissions.action, '*')))
      .limit(1);
    if (wildcard) return true;

    // Tam eşleşme
    const [exact] = await db.select().from(permissions)
      .where(and(eq(permissions.role, role), eq(permissions.resource, resource), eq(permissions.action, action)))
      .limit(1);
    return !!exact;
  },

  async getUserRole(userId: string): Promise<string | null> {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    return user?.role ?? null;
  },

  async listForRole(role: string) {
    return db.select().from(permissions).where(eq(permissions.role, role));
  },

  async seed(items: Array<{ role: string; resource: string; action: string }>) {
    if (items.length === 0) return;
    await db.insert(permissions).values(items).onConflictDoNothing();
  },
};
