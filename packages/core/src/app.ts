import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import type { Redis } from 'ioredis';
import { CmsError } from './errors/index.js';
import { authRoutes } from './api/rest/auth.routes.js';
import { usersRoutes } from './api/rest/users.routes.js';
import { pluginsRoutes } from './api/rest/plugins.routes.js';
import { marketplaceRoutes } from './api/rest/marketplace.routes.js';
import { adminRoutes } from './api/rest/admin.routes.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PluginRegistry } from './core/plugin-registry/index.js';
import type { EventBus } from '@module-cms/sdk';

interface AppOptions {
  redis: Redis;
  jwtSecret: string;
  eventBus?: EventBus;
}

export type { FastifyInstance } from 'fastify';

export async function buildApp(opts: AppOptions) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
  });

  // Plugins
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: opts.jwtSecret,
  });

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CmsError) {
      return reply.status(error.status).send(error.toJSON());
    }

    // HTTP status errors (validation, auth, etc.)
    if (error.statusCode === 400) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    if (error.statusCode === 401) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: error.message,
      });
    }
    if (error.statusCode === 403) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: error.message,
      });
    }

    app.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  }));

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth', redis: opts.redis });
  await app.register(usersRoutes, { prefix: '/api/v1/users', eventBus: opts.eventBus });

  // Admin + plugin active routes
  await app.register(adminRoutes, { prefix: '/api/v1' });

  // Plugin admin bundle static serving
  app.get('/plugins/:name/admin.js', async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.status(400).send({ error: 'INVALID_PLUGIN_NAME' });
    }
    const pluginsRoot = process.env.COMPOSE_PROJECT_ROOT
      ? path.join(process.env.COMPOSE_PROJECT_ROOT, 'plugins')
      : path.resolve(__dirname, '../../../plugins');
    const bundlePath = path.join(pluginsRoot, name, 'admin/dist/index.js');
    let content: string;
    try {
      content = await readFile(bundlePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ error: 'BUNDLE_NOT_FOUND' });
      }
      throw err;
    }
    return reply.type('application/javascript').send(content);
  });

  return app;
}

export async function registerPluginRoutes(
  app: Awaited<ReturnType<typeof buildApp>>,
  pluginRegistry: PluginRegistry,
) {
  await app.register(pluginsRoutes, {
    prefix: '/api/v1/plugins',
    pluginRegistry,
  });

  await app.register(marketplaceRoutes, {
    prefix: '/api/v1/marketplace',
    pluginRegistry,
  });
}

export type AppInstance = Awaited<ReturnType<typeof buildApp>>;

/**
 * Container plugin HTTP proxy.
 * Routes {prefix}/* → upstream (e.g. http://plugin-content:4001).
 * Uses Node's built-in fetch — no extra dependencies.
 */
export function registerContainerProxy(
  app: AppInstance,
  prefix: string,
  upstream: string,
): void {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
  for (const method of methods) {
    app.route({
      method,
      url: `${prefix}/*`,
      handler: async (request, reply) => {
        const targetUrl = `${upstream}${request.url}`;
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(request.headers)) {
          if (key === 'host' || key === 'content-length') continue;
          if (typeof value === 'string') headers[key] = value;
        }
        const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
        const body = hasBody && request.body !== undefined
          ? JSON.stringify(request.body)
          : undefined;

        const res = await fetch(targetUrl, { method: request.method, headers, body });
        reply.code(res.status);
        const ct = res.headers.get('content-type');
        if (ct) reply.header('content-type', ct);
        if (res.status === 204 || res.status === 304) return reply.send();
        const text = await res.text();
        try { return reply.send(JSON.parse(text)); } catch { return reply.send(text); }
      },
    });
  }
}
