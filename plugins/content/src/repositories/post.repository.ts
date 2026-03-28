import { and, eq, desc, count, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { posts, postCategories, postTags, tags } from '../../db/schema.js';

export type PostStatus = 'draft' | 'published' | 'archived';

export interface CreatePostData {
  title: string;
  slug: string;
  content?: unknown;
  excerpt?: string;
  authorId: string;
  status?: PostStatus;
  categoryIds?: string[];
  tagIds?: string[];
}

export interface UpdatePostData {
  title?: string;
  slug?: string;
  content?: unknown;
  excerpt?: string;
  status?: PostStatus;
  categoryIds?: string[];
  tagIds?: string[];
}

export interface ListPostsParams {
  page?: number;
  perPage?: number;
  status?: PostStatus;
  authorId?: string;
  categoryId?: string;
}

export const postRepository = {
  async list(params: ListPostsParams = {}) {
    const { page = 1, perPage = 20, status, authorId, categoryId } = params;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (status) conditions.push(eq(posts.status, status));
    if (authorId) conditions.push(eq(posts.authorId, authorId));

    if (categoryId) {
      const postIdsInCategory = await db
        .select({ postId: postCategories.postId })
        .from(postCategories)
        .where(eq(postCategories.categoryId, categoryId));
      conditions.push(inArray(posts.id, postIdsInCategory.map((r) => r.postId)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [totalRow]] = await Promise.all([
      db.select().from(posts).where(where).orderBy(desc(posts.createdAt)).limit(perPage).offset(offset),
      db.select({ total: count() }).from(posts).where(where),
    ]);

    return { posts: rows, total: totalRow?.total ?? 0 };
  },

  async findById(id: string) {
    const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return row ?? null;
  },

  async findBySlug(slug: string) {
    const [row] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    return row ?? null;
  },

  async create(data: CreatePostData) {
    const { categoryIds, tagIds, ...postData } = data;
    const [post] = await db.insert(posts).values(postData).returning();

    await Promise.all([
      categoryIds?.length
        ? db.insert(postCategories).values(categoryIds.map((c) => ({ postId: post!.id, categoryId: c })))
        : Promise.resolve(),
      tagIds?.length
        ? db.insert(postTags).values(tagIds.map((t) => ({ postId: post!.id, tagId: t })))
        : Promise.resolve(),
    ]);

    return post!;
  },

  async update(id: string, data: UpdatePostData) {
    const { categoryIds, tagIds, ...postData } = data;

    const updates: Record<string, unknown> = { ...postData, updatedAt: new Date() };
    const [post] = await db.update(posts).set(updates).where(eq(posts.id, id)).returning();
    if (!post) return null;

    if (categoryIds !== undefined) {
      await db.delete(postCategories).where(eq(postCategories.postId, id));
      if (categoryIds.length) {
        await db.insert(postCategories).values(categoryIds.map((c) => ({ postId: id, categoryId: c })));
      }
    }

    if (tagIds !== undefined) {
      await db.delete(postTags).where(eq(postTags.postId, id));
      if (tagIds.length) {
        await db.insert(postTags).values(tagIds.map((t) => ({ postId: id, tagId: t })));
      }
    }

    return post;
  },

  async publish(id: string) {
    const [post] = await db.update(posts)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return post ?? null;
  },

  async unpublish(id: string) {
    const [post] = await db.update(posts)
      .set({ status: 'draft', publishedAt: null, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return post ?? null;
  },

  async delete(id: string) {
    await db.update(posts)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(posts.id, id));
  },
};
