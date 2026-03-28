import { Redis } from 'ioredis';
import { sql } from './db/client.js';
import { CoreEventBus } from './core/event-bus/index.js';
import { PluginRegistry } from './core/plugin-registry/index.js';
import { buildApp } from './app.js';
import { createGrpcServer, startGrpcServer } from './api/grpc/server.js';
import { userRepository } from './db/repositories/user.repository.js';
import { permissionRepository } from './db/repositories/permission.repository.js';
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

  // 4. Plugin Registry
  // AppContext factory — her in-process plugin için bir context oluşturur
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
    db: {},  // Plugin kendi Prisma client'ını inject eder
    settings: {
      // Placeholder — Plugin Settings sistemi Faz 2'de plugin'in kendi DB'sinden gelir
      async get() { return null; },
      async set() {},
      async getAll() { return {}; },
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
  });

  const pluginRegistry = new PluginRegistry(eventBus, buildAppContext as Parameters<typeof PluginRegistry>[1]);
  console.info('[Core] Plugin Registry initialized');

  // 5. HTTP server (Fastify)
  const app = await buildApp({ redis, pluginRegistry, jwtSecret: JWT_SECRET });
  await app.listen({ port: HTTP_PORT, host: '0.0.0.0' });
  console.info(`[Core] HTTP server listening on port ${HTTP_PORT}`);

  // 6. gRPC server
  const grpcServer = createGrpcServer(eventBus);
  await startGrpcServer(grpcServer, GRPC_PORT);

  // 7. Graceful shutdown
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
