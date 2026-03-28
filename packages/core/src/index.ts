import 'dotenv/config';
import path from 'node:path';
import { Redis } from 'ioredis';
import { sql } from './db/client.js';
import { CoreEventBus } from './core/event-bus/index.js';
import { PluginRegistry } from './core/plugin-registry/index.js';
import { buildApp, registerPluginRoutes } from './app.js';
import { createGrpcServer, startGrpcServer } from './api/grpc/server.js';
import { userRepository } from './db/repositories/user.repository.js';
import { permissionRepository } from './db/repositories/permission.repository.js';
import { configRepository } from './db/repositories/config.repository.js';
import type { AppContext } from '@module-cms/sdk';

const HTTP_PORT  = parseInt(process.env.HTTP_PORT  ?? '3000', 10);
const GRPC_PORT  = parseInt(process.env.GRPC_PORT  ?? '50051', 10);
const REDIS_URL  = process.env.REDIS_URL  ?? 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

async function main() {
  console.info('[Core] Starting moduleCMS...');

  // 1. Redis
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  await redis.connect();
  console.info('[Core] Redis connected');

  // 2. DB — bağlantıyı test et
  await sql`SELECT 1`;
  console.info('[Core] Database connected');

  // 3. EventBus
  const eventBus = new CoreEventBus(REDIS_URL);
  await eventBus.initialize();
  console.info('[Core] EventBus initialized');

  // 4. HTTP server (Fastify) — plugin routes sonradan eklenir
  const app = await buildApp({ redis, jwtSecret: JWT_SECRET, eventBus });

  // 5. Plugin Registry
  const buildAppContext = async (manifest: { name: string; version: string; runtime: 'in-process' | 'container' }): Promise<AppContext> => ({
    eventBus,
    coreApi: {
      async getUser(id) {
        const user = await userRepository.findById(id);
        return { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
      },
      async listUsers(params) {
        const result = await userRepository.list(params);
        return {
          users: result.users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() })),
          total: result.total,
        };
      },
      async checkPermission({ userId, resource, action }) {
        return { allowed: await permissionRepository.check(userId, resource, action) };
      },
      async getUserRoles(userId) {
        const role = await permissionRepository.getUserRole(userId);
        return role ? [role] : [];
      },
    },
    db: {},
    settings: {
      async get(key) { return configRepository.get(`${manifest.name}:${key}`) as Promise<never>; },
      async set(key, value) { await configRepository.set(`${manifest.name}:${key}`, value); },
      async getAll() {
        const all = await configRepository.getAll();
        const prefix = `${manifest.name}:`;
        return Object.fromEntries(
          Object.entries(all)
            .filter(([k]) => k.startsWith(prefix))
            .map(([k, v]) => [k.slice(prefix.length), v]),
        ) as never;
      },
    },
    logger: {
      info:  (msg, data) => console.info(`[${manifest.name}] ${msg}`, data ?? ''),
      warn:  (msg, data) => console.warn(`[${manifest.name}] ${msg}`, data ?? ''),
      error: (msg, data) => console.error(`[${manifest.name}] ${msg}`, data ?? ''),
      debug: (msg, data) => console.debug(`[${manifest.name}] ${msg}`, data ?? ''),
    },
    config: {
      name: manifest.name,
      version: manifest.version,
      runtime: manifest.runtime,
    },
    http: {
      registerRoutes(prefix, plugin) {
        // Fastify ready olmadan önce register edilir, Fastify kuyruğa alır
        void app.register(plugin as Parameters<typeof app.register>[0], { prefix });
      },
    },
  });

  const pluginRegistry = new PluginRegistry(eventBus, buildAppContext as Parameters<typeof PluginRegistry>[1]);

  // Plugin routes + yüklü plugin'lerin route'larını register et
  await registerPluginRoutes(app, pluginRegistry);

  // Content Plugin'i yükle
  try {
    await pluginRegistry.register(path.resolve(process.cwd(), '../../plugins/content'));
    console.info('[Core] Content plugin loaded');
  } catch (err) {
    console.warn('[Core] Content plugin not found, skipping:', (err as Error).message);
  }

  console.info('[Core] Plugin Registry initialized');

  // 6. HTTP server'ı başlat
  await app.listen({ port: HTTP_PORT, host: '0.0.0.0' });
  console.info(`[Core] HTTP server listening on port ${HTTP_PORT}`);

  // 7. gRPC server
  const grpcServer = createGrpcServer(eventBus);
  await startGrpcServer(grpcServer, GRPC_PORT);

  // 8. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.info(`[Core] ${signal} received — shutting down gracefully...`);
    await app.close();
    grpcServer.forceShutdown();
    await eventBus.close();
    await redis.quit();
    await sql.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  console.info('[Core] moduleCMS ready ✓');
}

main().catch((err) => {
  console.error('[Core] Fatal error:', err);
  process.exit(1);
});
