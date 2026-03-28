import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { userSnapshots } from '../../db/schema.js';

export const userSnapshotRepository = {
  async upsert(data: { id: string; email: string; name: string; role: string }) {
    await db.insert(userSnapshots)
      .values({ ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSnapshots.id,
        set: { email: data.email, name: data.name, role: data.role, updatedAt: new Date() },
      });
  },

  async findById(id: string) {
    const [row] = await db.select().from(userSnapshots).where(eq(userSnapshots.id, id)).limit(1);
    return row ?? null;
  },
};
