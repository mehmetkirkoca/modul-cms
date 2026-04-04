import type { AppContext } from './context.js';

export type PluginRuntime = 'in-process' | 'container';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
}

export interface AdminPage {
  path: string;
  component: string;
  label: string;
  icon?: string;
}

export interface SettingsSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean';
    title: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
}

export interface ContentTypeDefinition {
  name: string;
  label: string;
  icon?: string;
  adminPage: string;
}

export interface BlockDefinition {
  name: string;
  label: string;
  icon?: string;
  editorComponent: string;
  renderComponent: string;
  schema: Record<string, unknown>;
}

export interface RoleDefinition {
  name: string;
  label: string;
  inherits?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  runtime: PluginRuntime;
  domain?: string;

  communication?: {
    external: 'event-or-core-api-only';
    internal?: 'direct-call' | 'event' | 'grpc';
  };

  subscribes?: string[];
  publishes?: string[];

  adminPages?: AdminPage[];

  settings?: {
    schema: SettingsSchema;
  };

  contentTypes?: ContentTypeDefinition[];
  blocks?: BlockDefinition[];
  roles?: RoleDefinition[];

  requires?: {
    cms?: string;
    coreApi?: string;
    plugins?: string[];
  };

  // Container plugin HTTP proxy — core routes {upstreamPrefix}/* → upstream
  upstream?: string;
  upstreamPrefix?: string;
}

export interface Plugin {
  name: string;
  version: string;
  register(ctx: AppContext): Promise<void>;
  onStart?(): Promise<void>;
  onStop?(): Promise<void>;
  onHealth?(): Promise<HealthStatus>;
}
