import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../auth/middleware.js';
import { CmsError } from '../../errors/index.js';
import type { PluginRegistry as PluginRegistryService } from '../../core/plugin-registry/index.js';
import { clonePlugin, buildPlugin, startPlugin } from '../../lib/container-manager.js';

const PLUGINS_BASE_PATH = process.env.COMPOSE_PROJECT_ROOT
  ? path.join(process.env.COMPOSE_PROJECT_ROOT, 'plugins')
  : path.resolve(process.cwd(), '../../plugins');

interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  gitUrl: string;
}

const MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  { name: 'content', version: '1.0.0', description: 'Blog posts and categories', author: 'moduleCMS', gitUrl: 'https://github.com/modulecms/plugin-content.git' },
  { name: 'seo',     version: '0.9.0', description: 'SEO meta tags and sitemaps',    author: 'moduleCMS', gitUrl: 'https://github.com/modulecms/plugin-seo.git' },
  { name: 'media',   version: '0.8.0', description: 'File uploads and media library', author: 'moduleCMS', gitUrl: 'https://github.com/modulecms/plugin-media.git' },
  { name: 'forms',   version: '0.5.0', description: 'Contact forms and form builder', author: 'moduleCMS', gitUrl: 'https://github.com/modulecms/plugin-forms.git' },
];

const InstallBodySchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Plugin name must be lowercase alphanumeric with dashes'),
});

export async function marketplaceRoutes(
  app: FastifyInstance,
  opts: { pluginRegistry: PluginRegistryService },
) {
  const { pluginRegistry } = opts;

  app.get('/plugins', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = (query['q'] ?? '').toLowerCase().trim();

    const results = q
      ? MARKETPLACE_PLUGINS.filter(
          (p) => p.name.includes(q) || p.description.toLowerCase().includes(q),
        )
      : MARKETPLACE_PLUGINS;

    // gitUrl'i client'a açmıyoruz
    return reply.send({ plugins: results.map(({ gitUrl: _g, ...rest }) => rest) });
  });

  app.post('/install', { preHandler: requireRole('super_admin') }, async (request, reply) => {
    const parsed = InstallBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new CmsError('INVALID_PLUGIN_NAME', parsed.error.errors[0]?.message ?? 'Invalid name', 422);
    }

    const { name } = parsed.data;

    const marketplaceEntry = MARKETPLACE_PLUGINS.find((p) => p.name === name);
    if (!marketplaceEntry) {
      throw new CmsError('MARKETPLACE_PLUGIN_NOT_FOUND', `Plugin "${name}" not found in marketplace`, 404);
    }

    const pluginPath = path.join(PLUGINS_BASE_PATH, name);

    try {
      await clonePlugin(name, marketplaceEntry.gitUrl);
      await buildPlugin(name);
      await startPlugin(name);
      await pluginRegistry.register(pluginPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Install failed';
      throw new CmsError('INSTALL_FAILED', message, 422);
    }

    return reply.status(201).send({ success: true, name });
  });
}
