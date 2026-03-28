import type { PluginManifest } from '@module-cms/sdk';

const manifest: PluginManifest = {
  name:    'content',
  version: '1.0.0',
  runtime: 'in-process',

  subscribes: ['core:user:created:v1', 'core:user:updated:v1'],
  publishes:  ['content:post:saved:v1', 'content:post:published:v1'],

  adminPages: [
    { path: '/content/posts',      component: 'content-posts-page',      label: 'Posts' },
    { path: '/content/categories', component: 'content-categories-page', label: 'Categories' },
  ],
};

export default manifest;
