import { pgTable, text, uuid, timestamp, jsonb, index, primaryKey, boolean } from 'drizzle-orm/pg-core';

export const userSnapshots = pgTable('user_snapshots', {
  id:        uuid('id').primaryKey(),
  email:     text('email').notNull(),
  name:      text('name').notNull(),
  role:      text('role').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  parentId:  uuid('parent_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tags = pgTable('tags', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  slug:        text('slug').notNull().unique(),
  content:     jsonb('content'),           // Tiptap JSON
  excerpt:     text('excerpt'),
  status:      text('status').notNull().default('draft'), // draft | published | archived
  authorId:    uuid('author_id').notNull(),
  publishedAt: timestamp('published_at'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('posts_status_idx').on(t.status),
  index('posts_author_idx').on(t.authorId),
]);

export const postCategories = pgTable('post_categories', {
  postId:     uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.postId, t.categoryId] })]);

export const postTags = pgTable('post_tags', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tagId:  uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.postId, t.tagId] })]);

export const postMeta = pgTable('post_meta', {
  postId:    uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  metaKey:   text('meta_key').notNull(),
  metaValue: jsonb('meta_value'),
}, (t) => [primaryKey({ columns: [t.postId, t.metaKey] })]);

export const pluginSettings = pgTable('plugin_settings', {
  key:       text('key').primaryKey(),
  value:     jsonb('value'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
