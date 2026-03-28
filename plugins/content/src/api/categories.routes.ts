import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { categoryRepository } from '../repositories/category.repository.js';
import { requireRole, EDITOR_ROLES, ADMIN_ROLES } from '../auth.js';
import type { AppContext } from '@module-cms/sdk';

const CategorySchema = z.object({
  name:     z.string().min(1).max(255),
  slug:     z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  parentId: z.string().uuid().optional(),
});

export async function categoriesRoutes(app: FastifyInstance, opts: { ctx: AppContext }) {
  const { ctx } = opts;

  app.get('/', async (_request, reply) => {
    const result = await categoryRepository.list();
    return reply.send({ categories: result });
  });

  app.post('/', async (request, reply) => {
    await requireRole(request, EDITOR_ROLES, ctx);
    const data = CategorySchema.parse(request.body);
    const category = await categoryRepository.create(data);
    return reply.status(201).send({ category });
  });

  app.put('/:id', async (request, reply) => {
    await requireRole(request, EDITOR_ROLES, ctx);
    const { id } = request.params as { id: string };
    const data = CategorySchema.partial().parse(request.body);
    const category = await categoryRepository.update(id, data);
    if (!category) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Category not found' });
    return reply.send({ category });
  });

  app.delete('/:id', async (request, reply) => {
    await requireRole(request, ADMIN_ROLES, ctx);
    const { id } = request.params as { id: string };
    await categoryRepository.delete(id);
    return reply.send({ success: true });
  });
}
