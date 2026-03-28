import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { pluginRegistry, type PluginEntry } from '../../../db/schema.js';
import { NotFoundError } from '../../errors/index.js';

export type RegisterPluginInput = {
  name: string;
  version: string;
  runtime: string;
  adminPages?: unknown;
  manifest?: unknown;
};

export const pluginRepository = {
  async findByName(name: string): Promise<PluginEntry> {
    const [plugin] = await db.select().from(pluginRegistry).where(eq(pluginRegistry.name, name)).limit(1);
    if (!plugin) throw new NotFoundError('Plugin', name);
    return plugin;
  },

  async list(status?: string) {
    if (status) {
      return db.select().from(pluginRegistry).where(eq(pluginRegistry.status, status));
    }
    return db.select().from(pluginRegistry);
  },

  async listActive() {
    return db.select().from(pluginRegistry).where(eq(pluginRegistry.status, 'active'));
  },

  async register(input: RegisterPluginInput): Promise<PluginEntry> {
    const [existing] = await db.select().from(pluginRegistry).where(eq(pluginRegistry.name, input.name)).limit(1);

    if (existing) {
      const [updated] = await db.update(pluginRegistry)
        .set({
          version:    input.version,
          runtime:    input.runtime,
          status:     'active',
          adminPages: input.adminPages as never ?? null,
          manifest:   input.manifest  as never ?? null,
        })
        .where(eq(pluginRegistry.name, input.name))
        .returning();
      return updated!;
    }

    const [created] = await db.insert(pluginRegistry)
      .values({
        name:       input.name,
        version:    input.version,
        runtime:    input.runtime,
        status:     'active',
        adminPages: input.adminPages as never ?? null,
        manifest:   input.manifest  as never ?? null,
      })
      .returning();
    return created!;
  },

  async setStatus(name: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
    await db.update(pluginRegistry).set({ status }).where(eq(pluginRegistry.name, name));
  },
};
