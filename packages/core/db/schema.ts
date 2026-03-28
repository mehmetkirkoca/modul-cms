import { pgTable, uuid, varchar, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';

// ─── Core DB: sadece orkestrasyon — 4 tablo ───────────────────────────────
// posts, categories, post_meta YOKTUR. Content Plugin DB'sindedir.

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     varchar('email', { length: 255 }).unique().notNull(),
  name:      varchar('name', { length: 255 }).notNull(),
  password:  varchar('password', { length: 255 }).notNull(),
  role:      varchar('role', { length: 50 }).notNull().default('subscriber'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id:       uuid('id').primaryKey().defaultRandom(),
  role:     varchar('role', { length: 50 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  action:   varchar('action', { length: 50 }).notNull(),
}, (t) => [
  unique('permissions_role_resource_action_unique').on(t.role, t.resource, t.action),
]);

export const pluginRegistry = pgTable('plugin_registry', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 255 }).unique().notNull(),
  version:      varchar('version', { length: 50 }).notNull(),
  runtime:      varchar('runtime', { length: 50 }).notNull(),
  status:       varchar('status', { length: 50 }).notNull().default('active'),
  adminPages:   jsonb('admin_pages'),
  manifest:     jsonb('manifest'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
});

export const systemConfig = pgTable('system_config', {
  key:       varchar('key', { length: 255 }).primaryKey(),
  value:     jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Inferred types
export type User           = typeof users.$inferSelect;
export type NewUser        = typeof users.$inferInsert;
export type Permission     = typeof permissions.$inferSelect;
export type PluginEntry    = typeof pluginRegistry.$inferSelect;
export type SystemConfig   = typeof systemConfig.$inferSelect;
