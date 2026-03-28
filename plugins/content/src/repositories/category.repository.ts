import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { categories } from '../../db/schema.js';

export type CreateCategoryData = { name: string; slug: string; parentId?: string };
export type UpdateCategoryData = Partial<CreateCategoryData>;

export const categoryRepository = {
  async list() {
    return db.select().from(categories).orderBy(categories.name);
  },

  async findById(id: string) {
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return row ?? null;
  },

  async findBySlug(slug: string) {
    const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return row ?? null;
  },

  async create(data: CreateCategoryData) {
    const [row] = await db.insert(categories).values(data).returning();
    return row!;
  },

  async update(id: string, data: UpdateCategoryData) {
    const [row] = await db.update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(categories).where(eq(categories.id, id));
  },
};
