import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<{ default: unknown }>;

/** Dev'de .ts, production'da .js kullanır */
async function loadModule(filePath: string): Promise<{ default: unknown }> {
  const isDev = process.env.NODE_ENV !== 'production';
  const tsPath = filePath + '.ts';
  const target = (isDev && existsSync(tsPath)) ? tsPath : filePath + '.js';
  return dynamicImport(pathToFileURL(target).href);
}
import type { Plugin, PluginManifest } from '@module-cms/sdk';
import { pluginRepository } from '../../db/repositories/plugin.repository.js';
import { CoreEventBus } from '../event-bus/index.js';
import { PluginError } from '../../errors/index.js';

// Manifest validation schema
const ManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  runtime: z.enum(['in-process', 'container']),
  description: z.string().optional(),
  domain: z.string().optional(),
  communication: z.object({
    external: z.literal('event-or-core-api-only'),
    internal: z.enum(['direct-call', 'event', 'grpc']).optional(),
  }).optional(),
  subscribes: z.array(z.string()).optional(),
  publishes: z.array(z.string()).optional(),
  adminPages: z.array(z.object({
    path: z.string(),
    component: z.string(),
    label: z.string(),
    icon: z.string().optional(),
  })).optional(),
  settings: z.object({
    schema: z.record(z.unknown()),
  }).optional(),
  upstream: z.string().optional(),
  upstreamPrefix: z.string().optional(),
});

interface LoadedPlugin {
  manifest: PluginManifest;
  instance: Plugin;
}

/**
 * Plugin Registry
 * - Manifest dosyasını yükler ve validate eder
 * - In-process plugin'leri dinamik olarak import eder
 * - Container plugin'leri DB'ye kaydeder (Docker yönetir)
 * - Hot-registration: restart gerekmez
 */
export class PluginRegistry {
  private readonly loaded = new Map<string, LoadedPlugin>();

  constructor(
    private readonly eventBus: CoreEventBus,
    private readonly buildAppContext: (manifest: PluginManifest) => Promise<unknown>,
  ) {}

  /**
   * Bir plugin dizininden manifest + plugin'i yükle ve register et.
   * pluginPath: plugin.manifest.ts dosyasının bulunduğu dizin
   */
  async register(pluginPath: string): Promise<void> {
    const absolutePath = path.resolve(pluginPath);
    const manifestPath = path.join(absolutePath, 'plugin.manifest');
    const indexPath = path.join(absolutePath, 'src', 'index');

    // 1. Manifest yükle ve validate et
    let rawManifest: unknown;
    try {
      const module = await loadModule(manifestPath);
      rawManifest = module.default;
    } catch (err) {
      throw new PluginError('unknown', `Manifest yüklenemedi: ${manifestPath}`, { err });
    }

    const manifestResult = ManifestSchema.safeParse(rawManifest);
    if (!manifestResult.success) {
      throw new PluginError('unknown', `Manifest validation hatası`, {
        errors: manifestResult.error.flatten(),
        path: manifestPath,
      });
    }
    const manifest = manifestResult.data as PluginManifest;

    // 2. Build-time iletişim kuralı kontrolü
    if (manifest.runtime === 'container' && manifest.communication?.internal === 'direct-call') {
      throw new PluginError(manifest.name, 'Container plugin "direct-call" internal communication seçemez.');
    }
    if (manifest.runtime === 'in-process' && manifest.communication?.internal === 'grpc') {
      throw new PluginError(manifest.name, 'In-process plugin "grpc" internal communication seçemez.');
    }

    // 3. Zaten bellekte yüklüyse sadece DB durumunu güncelle ve event yay
    if (this.loaded.has(manifest.name)) {
      await pluginRepository.setStatus(manifest.name, 'active');
      await this.eventBus.emit('core:plugin:activated:v1', {
        pluginName: manifest.name,
        version: manifest.version,
        runtime: manifest.runtime,
      });
      console.info(`[PluginRegistry] Already loaded, status restored: ${manifest.name}`);
      return;
    }

    // 4. DB'ye kaydet
    await pluginRepository.register({
      name: manifest.name,
      version: manifest.version,
      runtime: manifest.runtime,
      adminPages: manifest.adminPages,
      manifest: manifest as unknown as Record<string, unknown>,
    });

    // 5. In-process plugin: dinamik import
    if (manifest.runtime === 'in-process') {
      let pluginModule: { default: Plugin };
      try {
        pluginModule = await loadModule(indexPath) as { default: Plugin };
      } catch (err) {
        await pluginRepository.setStatus(manifest.name, 'error');
        throw new PluginError(manifest.name, `Plugin modülü yüklenemedi`, { err });
      }

      const instance = pluginModule.default;
      if (!instance || typeof instance.register !== 'function') {
        throw new PluginError(manifest.name, 'Plugin, register() fonksiyonu export etmelidir.');
      }

      // AppContext oluştur ve plugin'i register et
      const ctx = await this.buildAppContext(manifest);
      try {
        await instance.register(ctx as Parameters<typeof instance.register>[0]);
        await instance.onStart?.();
      } catch (err) {
        await pluginRepository.setStatus(manifest.name, 'error');
        throw new PluginError(manifest.name, 'Plugin register/start hatası', { err });
      }

      this.loaded.set(manifest.name, { manifest, instance });
    }

    // Container plugin için Docker Compose yönetir — burada sadece DB kaydı yeterli.

    // 6. core:plugin:activated event'i yay
    await this.eventBus.emit('core:plugin:activated:v1', {
      pluginName: manifest.name,
      version: manifest.version,
      runtime: manifest.runtime,
    });

    console.info(`[PluginRegistry] Registered: ${manifest.name}@${manifest.version} (${manifest.runtime})`);
  }

  async unregister(name: string): Promise<void> {
    const loaded = this.loaded.get(name);
    try {
      if (loaded?.instance.onStop) {
        await loaded.instance.onStop();
      }
    } finally {
      this.loaded.delete(name);
      await pluginRepository.setStatus(name, 'inactive');
    }
  }

  getLoaded(name: string): LoadedPlugin | undefined {
    return this.loaded.get(name);
  }

  listLoaded(): PluginManifest[] {
    return Array.from(this.loaded.values()).map((p) => p.manifest);
  }

  async healthCheck(name: string): Promise<{ status: string; details?: unknown }> {
    const loaded = this.loaded.get(name);
    if (!loaded) return { status: 'not-loaded' };
    if (!loaded.instance.onHealth) return { status: 'healthy' };
    try {
      const result = await loaded.instance.onHealth();
      return result;
    } catch (err) {
      return { status: 'unhealthy', details: err instanceof Error ? err.message : String(err) };
    }
  }
}
