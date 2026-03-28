import type { PluginManifest } from '../types/plugin.js';

/**
 * Plugin manifest tanımlamak için kullanılan helper.
 * Runtime type enforcement sağlar, IDE autocomplete çalışır.
 */
export function definePlugin(manifest: PluginManifest): PluginManifest {
  // Container plugin direct-call seçemez
  if (
    manifest.runtime === 'container' &&
    manifest.communication?.internal === 'direct-call'
  ) {
    throw new Error(
      `[${manifest.name}] Container plugin "direct-call" internal communication seçemez. "grpc" veya "event" kullanın.`,
    );
  }

  // In-process plugin grpc seçemez
  if (
    manifest.runtime === 'in-process' &&
    manifest.communication?.internal === 'grpc'
  ) {
    throw new Error(
      `[${manifest.name}] In-process plugin "grpc" internal communication seçemez. "direct-call" veya "event" kullanın.`,
    );
  }

  return manifest;
}
