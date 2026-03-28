import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { configRepository } from '../../db/repositories/config.repository.js';
import { requireAuth } from '../../auth/middleware.js';

interface AdminPage {
  path: string;
  component: string;
  label: string;
  icon?: string;
}

interface ThemeManifest {
  name: string;
  version: string;
  framework: string;
  requires?: string[];
}

export async function adminRoutes(app: FastifyInstance) {
  // GET /admin/navigation — auth gerekli
  app.get('/admin/navigation', { preHandler: requireAuth }, async (_request, reply) => {
    const plugins = await pluginRepository.listActive();
    const navigation = plugins
      .filter((p) => p.adminPages && (p.adminPages as AdminPage[]).length > 0)
      .flatMap((p) =>
        (p.adminPages as AdminPage[]).map((page) => ({
          ...page,
          bundleUrl: `/plugins/${p.name}/admin.js`,
        })),
      );
    return reply.send(navigation);
  });

  // GET /plugins/active — public
  app.get('/plugins/active', async (_request, reply) => {
    const plugins = await pluginRepository.listActive();
    return reply.send(plugins.map((p) => p.name));
  });

  // POST /themes/:name/activate — auth gerekli
  app.post('/themes/:name/activate', { preHandler: requireAuth }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.status(400).send({ error: 'INVALID_THEME_NAME' });
    }

    const manifestPath = path.resolve(
      process.cwd(),
      `../../themes/${name}/theme.manifest.json`,
    );

    if (!existsSync(manifestPath)) {
      return reply.status(404).send({ error: 'THEME_NOT_FOUND', name });
    }

    const manifest: ThemeManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    const activePlugins = await pluginRepository.listActive();
    const activeNames = activePlugins.map((p) => p.name);
    const missing = (manifest.requires ?? []).filter((r) => !activeNames.includes(r));

    if (missing.length > 0) {
      return reply.status(400).send({ error: 'MISSING_PLUGINS', missing });
    }

    await configRepository.set('active_theme', name);
    return reply.send({ theme: name, activated: true });
  });
}
