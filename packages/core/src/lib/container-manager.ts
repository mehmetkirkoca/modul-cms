import { execFile } from 'node:child_process';
import { rm, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// Mounted project root — accessible by both docker compose (file reads) and Node.js (fs ops)
const PROJECT_ROOT = process.env.COMPOSE_PROJECT_ROOT ?? path.resolve(process.cwd(), '../..');
const PLUGINS_HOST_DIR = path.join(PROJECT_ROOT, 'plugins');

// Same path for fs operations — project is mounted at COMPOSE_PROJECT_ROOT inside the container
const PLUGINS_DIR = PLUGINS_HOST_DIR;

const PROJECT_NAME = process.env.COMPOSE_PROJECT_NAME ?? 'modulecms';

/** Full compose args for build (needs main compose for network definitions) */
function fullComposeArgs(name: string): string[] {
  const pluginCompose = path.join(PLUGINS_HOST_DIR, name, 'docker-compose.plugin.yml');
  return [
    'compose',
    '--project-name', PROJECT_NAME,
    '-f', path.join(PROJECT_ROOT, 'docker-compose.yml'),
    '-f', pluginCompose,
  ];
}

/** Plugin-only compose args for start/stop (network is external, no main compose needed) */
function pluginComposeArgs(name: string): string[] {
  const pluginCompose = path.join(PLUGINS_HOST_DIR, name, 'docker-compose.plugin.yml');
  return ['compose', '--project-name', PROJECT_NAME, '-f', pluginCompose];
}

/** .gitmodules içinde submodule kaydı var mı kontrol et */
async function isSubmodule(name: string): Promise<boolean> {
  try {
    const content = await readFile(path.join(PROJECT_ROOT, '.gitmodules'), 'utf-8');
    return content.includes(`plugins/${name}`);
  } catch {
    return false;
  }
}

/** plugins/<name> dizinini indir. Submodule ise git submodule update, değilse git clone. */
export async function clonePlugin(name: string, gitUrl: string): Promise<void> {
  const dest = path.join(PLUGINS_DIR, name);
  try {
    await access(dest);
    return; // already exists
  } catch {
    // not found, proceed
  }
  if (await isSubmodule(name)) {
    await exec('git', ['config', '--global', '--add', 'safe.directory', PROJECT_ROOT]);
    await exec('git', ['-C', PROJECT_ROOT, 'submodule', 'update', '--init', '--depth', '1', `plugins/${name}`]);
  } else {
    await exec('git', ['clone', '--depth', '1', gitUrl, dest]);
  }
  // Volume mount via Docker changes file ownership — restore to current user
  try {
    await exec('chown', ['-R', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`, dest]);
  } catch {
    // Non-critical — may fail in some environments
  }
}

/** Plugin container image'ını build et */
export async function buildPlugin(name: string): Promise<void> {
  // Skip if image already exists
  try {
    await exec('docker', ['image', 'inspect', `modulecms-plugin-${name}`]);
    return;
  } catch {
    // not found, build it
  }
  await exec('docker', [...fullComposeArgs(name), '--profile', 'container', 'build', `plugin-${name}`]);
}

/** Plugin container'ı başlat */
export async function startPlugin(name: string): Promise<void> {
  await exec('docker', [
    ...pluginComposeArgs(name),
    '--profile', 'container',
    'up', '-d', `plugin-${name}`,
  ]);
}

/** Plugin container'ı durdur ve kaldır */
export async function stopPlugin(name: string): Promise<void> {
  try {
    await exec('docker', [...pluginComposeArgs(name), 'rm', '-sf', `plugin-${name}`]);
  } catch {
    // container may not exist, ignore
  }
}

/** plugins/<name> dizinini fiziksel olarak sil */
export async function deletePluginFiles(name: string): Promise<void> {
  await rm(path.join(PLUGINS_DIR, name), { recursive: true, force: true });
}
