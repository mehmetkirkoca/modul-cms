import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { configRepository } from '../../db/repositories/config.repository.js';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import { CmsError } from '../../errors/index.js';

interface AdminPage {
  path: string;
  component: string;
  label: string;
  icon?: string;
}

const ThemeManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  framework: z.string().min(1),
  requires: z.array(z.string()).optional(),
});

type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

export async function adminRoutes(app: FastifyInstance) {
  // GET /admin/navigation — auth gerekli
  app.get('/admin/navigation', { preHandler: requireAuth }, async (_request, reply) => {
    const plugins = await pluginRepository.listActive();
    const navigation = plugins
      .filter((p) => Array.isArray(p.adminPages) && p.adminPages.length > 0)
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
  app.post('/themes/:name/activate', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new CmsError('INVALID_THEME_NAME', 'Theme name must be lowercase alphanumeric with dashes', 400);
    }

    const manifestPath = path.resolve(
      __dirname,
      '../../../../../themes',
      name,
      'theme.manifest.json',
    );

    let manifest: ThemeManifest;
    try {
      const raw = await readFile(manifestPath, 'utf-8');
      try {
        const parsed = ThemeManifestSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          throw new CmsError('INVALID_MANIFEST', 'Theme manifest schema is invalid', 400);
        }
        manifest = parsed.data;
      } catch (parseErr) {
        if (parseErr instanceof CmsError) throw parseErr;
        throw new CmsError('INVALID_MANIFEST', 'Theme manifest is not valid JSON', 400);
      }
    } catch (err: unknown) {
      if (err instanceof CmsError) throw err;
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new CmsError('THEME_NOT_FOUND', `Theme "${name}" not found`, 404);
      }
      throw err;
    }

    const activePlugins = await pluginRepository.listActive();
    const activeNames = activePlugins.map((p) => p.name);
    const missing = (manifest.requires ?? []).filter((r) => !activeNames.includes(r));

    if (missing.length > 0) {
      throw new CmsError('MISSING_PLUGINS', `Required plugins not active: ${missing.join(', ')}`, 400);
    }

    await configRepository.set('active_theme', name);
    return reply.send({ theme: name, activated: true });
  });
}
