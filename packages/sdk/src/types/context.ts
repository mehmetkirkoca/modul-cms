import type { EventBus } from './events.js';

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

export interface CoreApiClient {
  getUser(id: string): Promise<CoreUser>;
  listUsers(params?: { page?: number; perPage?: number; role?: string }): Promise<{ users: CoreUser[]; total: number }>;
  checkPermission(params: { userId: string; resource: string; action: string }): Promise<{ allowed: boolean }>;
  getUserRoles(userId: string): Promise<string[]>;
}

export interface CoreUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDatabase {
  // Plugin'in kendi DB'sine erişim — Prisma client wrapper
  // Her plugin kendi schema'sını tanımlar, bu sadece interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SettingsClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  getAll<T = Record<string, unknown>>(): Promise<T>;
}

export interface PluginConfig {
  name: string;
  version: string;
  runtime: 'in-process' | 'container';
}

export interface HttpRegistrar {
  registerRoutes(prefix: string, plugin: (app: unknown, opts: unknown, done: () => void) => void): void;
}

export interface AppContext {
  eventBus: EventBus;
  coreApi: CoreApiClient;
  db: PluginDatabase;
  settings: SettingsClient;
  logger: Logger;
  config: PluginConfig;
  http: HttpRegistrar;
}
