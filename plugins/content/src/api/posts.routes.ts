import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { postRepository } from '../repositories/post.repository.js';
import { requireRole, getVerifiedUser, EDITOR_ROLES, ADMIN_ROLES } from '../auth.js';
import type { AppContext } from '@module-cms/sdk';

const CreatePostSchema = z.object({
  title:       z.string().min(1).max(500),
  slug:        z.string().min(1).max(500).regex(/^[a-z0-9-]+$/),
  content:     z.unknown().optional(),
  excerpt:     z.string().max(1000).optional(),
  status:      z.enum(['draft', 'published', 'archived']).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  tagIds:      z.array(z.string().uuid()).optional(),
});

const UpdatePostSchema = CreatePostSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

const ListQuerySchema = z.object({
  page:       z.coerce.number().min(1).optional(),
  perPage:    z.coerce.number().min(1).max(100).optional(),
  status:     z.enum(['draft', 'published', 'archived']).optional(),
  authorId:   z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

export async function postsRoutes(app: FastifyInstance, opts: { ctx: AppContext }) {
  const { ctx } = opts;

  // GET /posts — public (published) veya auth (tüm statüsler)
  app.get('/', async (request, reply) => {
    const query = ListQuerySchema.parse(request.query);
    const result = await postRepository.list(query);
    return reply.send(result);
  });

  // GET /posts/:slug — public
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const post = await postRepository.findBySlug(slug);
    if (!post) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Post not found' });
    return reply.send({ post });
  });

  // POST /posts — editor+
  app.post('/', async (request, reply) => {
    await requireRole(request, EDITOR_ROLES, ctx);
    const data = CreatePostSchema.parse(request.body);
    const user = await getVerifiedUser(request);
    const post = await postRepository.create({ ...data, authorId: user.sub });
    void ctx.eventBus.emit('content:post:saved:v1', { postId: post.id, title: post.title, authorId: post.authorId, status: post.status });
    return reply.status(201).send({ post });
  });

  // PUT /posts/:id — author veya admin
  app.put('/:id', async (request, reply) => {
    const user = await getVerifiedUser(request);
    const { id } = request.params as { id: string };

    const existing = await postRepository.findById(id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Post not found' });

    const isAdmin = ADMIN_ROLES.includes(user.role as never);
    if (existing.authorId !== user.sub && !isAdmin) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot edit another author\'s post' });
    }

    const data = UpdatePostSchema.parse(request.body);
    const post = await postRepository.update(id, data);
    void ctx.eventBus.emit('content:post:saved:v1', { postId: id, title: post!.title, authorId: post!.authorId, status: post!.status });
    return reply.send({ post });
  });

  // POST /posts/:id/publish — editor+
  app.post('/:id/publish', async (request, reply) => {
    await requireRole(request, EDITOR_ROLES, ctx);
    const { id } = request.params as { id: string };
    const post = await postRepository.publish(id);
    if (!post) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Post not found' });
    void ctx.eventBus.emit('content:post:published:v1', { postId: post.id, title: post.title, authorId: post.authorId, publishedAt: post.publishedAt?.toISOString() ?? new Date().toISOString() });
    return reply.send({ post });
  });

  // POST /posts/:id/unpublish — editor+
  app.post('/:id/unpublish', async (request, reply) => {
    await requireRole(request, EDITOR_ROLES, ctx);
    const { id } = request.params as { id: string };
    const post = await postRepository.unpublish(id);
    if (!post) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Post not found' });
    return reply.send({ post });
  });

  // DELETE /posts/:id — admin (soft delete → archived)
  app.delete('/:id', async (request, reply) => {
    await requireRole(request, ADMIN_ROLES, ctx);
    const { id } = request.params as { id: string };
    await postRepository.delete(id);
    return reply.send({ success: true });
  });
}
