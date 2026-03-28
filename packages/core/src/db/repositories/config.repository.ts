import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { systemConfig } from '../../../db/schema.js';

export const configRepository = {
  async get(key: string): Promise<unknown | null> {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
    return row?.value ?? null;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.insert(systemConfig)
      .values({ key, value: value as never })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: value as never, updatedAt: new Date() },
      });
  },

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await db.select().from(systemConfig);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
};
