import type { FastifyInstance } from 'fastify';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { requirePermission, requireRole } from '../../auth/middleware.js';
import { ValidationError } from '../../errors/index.js';
import type { PluginRegistry as PluginRegistryService } from '../../core/plugin-registry/index.js';

export async function pluginsRoutes(
  app: FastifyInstance,
  opts: { pluginRegistry: PluginRegistryService },
) {
  const { pluginRegistry } = opts;

  /**
   * GET /api/v1/plugins — kayıtlı plugin listesi
   */
  app.get('/', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const plugins = await pluginRepository.list(query['status']);
    return reply.send({ plugins });
  });

  /**
   * GET /api/v1/plugins/:name
   */
  app.get('/:name', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const plugin = await pluginRepository.findByName(name);
    return reply.send({ plugin });
  });

  /**
   * POST /api/v1/plugins/register — hot-registration (super_admin only)
   * Body: { path: string } — plugin dizin yolu
   */
  app.post('/register', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const { path } = request.body as { path: string };
    if (!path) {
      throw new ValidationError('path is required');
    }

    await pluginRegistry.register(path);
    return reply.status(201).send({ success: true });
  });

  /**
   * DELETE /api/v1/plugins/:name — plugin'i devre dışı bırak (super_admin only)
   */
  app.delete('/:name', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    await pluginRegistry.unregister(name);
    return reply.send({ success: true });
  });

  /**
   * GET /api/v1/plugins/:name/health
   */
  app.get('/:name/health', { preHandler: requirePermission('plugin', 'read') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const health = await pluginRegistry.healthCheck(name);
    return reply.send(health);
  });

  /**
   * GET /api/core/admin/navigation — admin shell için navigation items
   * (Auth zorunlu ama herhangi bir authenticated user görebilir)
   */
  app.get('/admin/navigation', { preHandler: requirePermission('plugin', 'read') }, async (_request, reply) => {
    const plugins = pluginRegistry.listLoaded();
    const navItems = plugins.flatMap((manifest) =>
      (manifest.adminPages ?? []).map((page) => ({
        pluginName: manifest.name,
        path: page.path,
        label: page.label,
        component: page.component,
        icon: page.icon,
      })),
    );
    return reply.send({ navItems });
  });
}
