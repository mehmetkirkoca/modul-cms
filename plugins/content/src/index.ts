import type { Plugin, AppContext } from '@module-cms/sdk';
import type { FastifyInstance } from 'fastify';
import { postsRoutes } from './api/posts.routes.js';
import { categoriesRoutes } from './api/categories.routes.js';
import { registerUserHandlers } from './handlers/user-updated.handler.js';

const plugin: Plugin = {
  name:    'content',
  version: '1.0.0',

  async register(ctx: AppContext) {
    registerUserHandlers(ctx.eventBus);

    ctx.http.registerRoutes('/api/v1/content/posts', (app, _opts, done) => {
      void postsRoutes(app as FastifyInstance, { ctx }).then(done).catch(done);
    });

    ctx.http.registerRoutes('/api/v1/content/categories', (app, _opts, done) => {
      void categoriesRoutes(app as FastifyInstance, { ctx }).then(done).catch(done);
    });

    ctx.logger.info('Content plugin registered');
  },
};

export default plugin;
