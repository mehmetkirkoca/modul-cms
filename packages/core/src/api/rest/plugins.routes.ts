import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { requirePermission, requireRole } from '../../auth/middleware.js';
import { CmsError } from '../../errors/index.js';
import type { PluginRegistry as PluginRegistryService } from '../../core/plugin-registry/index.js';
import { stopPlugin, deletePluginFiles } from '../../lib/container-manager.js';

const PLUGINS_BASE_PATH = process.env.COMPOSE_PROJECT_ROOT
  ? path.join(process.env.COMPOSE_PROJECT_ROOT, 'plugins')
  : path.resolve(process.cwd(), '../../plugins');

const PluginStatusSchema = z.enum(['active', 'inactive', 'error']);
const PluginNameSchema = z.string().min(1).regex(/^[a-z0-9-]+$/, 'Plugin name must be lowercase alphanumeric with dashes');
const RegisterBodySchema = z.object({ name: PluginNameSchema });

export async function pluginsRoutes(
  app: FastifyInstance,
  opts: { pluginRegistry: PluginRegistryService },
) {
  const { pluginRegistry } = opts;

  app.get('/', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const rawStatus = query['status'];
    if (rawStatus !== undefined) {
      const parsed = PluginStatusSchema.safeParse(rawStatus);
      if (!parsed.success) {
        throw new CmsError('INVALID_STATUS', `Status must be one of: active, inactive, error`, 400);
      }
      const plugins = await pluginRepository.list(parsed.data);
      return reply.send({ plugins });
    }
    const plugins = await pluginRepository.list();
    return reply.send({ plugins });
  });

  app.get('/:name', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!PluginNameSchema.safeParse(name).success) {
      throw new CmsError('INVALID_PLUGIN_NAME', 'Plugin name must be lowercase alphanumeric with dashes', 400);
    }
    const plugin = await pluginRepository.findByName(name);
    return reply.send({ plugin });
  });

  app.post('/register', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const parsed = RegisterBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new CmsError('INVALID_PLUGIN_NAME', parsed.error.errors[0]?.message ?? 'Invalid name', 422);
    }

    const pluginPath = path.join(PLUGINS_BASE_PATH, parsed.data.name);
    await pluginRegistry.register(pluginPath);
    return reply.status(201).send({ success: true });
  });

  app.delete('/:name', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!PluginNameSchema.safeParse(name).success) {
      throw new CmsError('INVALID_PLUGIN_NAME', 'Plugin name must be lowercase alphanumeric with dashes', 400);
    }
    const query = request.query as Record<string, string>;

    if (query['remove'] === 'true') {
      await pluginRegistry.unregister(name);
      await stopPlugin(name);
      await pluginRepository.remove(name);
      await deletePluginFiles(name);
    } else {
      await pluginRegistry.unregister(name);
    }

    return reply.send({ success: true });
  });

  app.get('/:name/health', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!PluginNameSchema.safeParse(name).success) {
      throw new CmsError('INVALID_PLUGIN_NAME', 'Plugin name must be lowercase alphanumeric with dashes', 400);
    }
    const health = await pluginRegistry.healthCheck(name);
    return reply.send(health);
  });
}
