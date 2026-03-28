import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userRepository } from '../../db/repositories/user.repository.js';
import { requireAuth, requirePermission } from '../../auth/middleware.js';
import { ValidationError, ForbiddenError } from '../../errors/index.js';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
  role: z.enum(['subscriber', 'editor', 'admin', 'super_admin']).optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role: z.enum(['subscriber', 'editor', 'admin', 'super_admin']).optional(),
  password: z.string().min(8).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/users
   * Yalnızca admin+
   */
  app.get('/', {
    preHandler: requirePermission('user', 'read'),
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query['page'] ?? '1', 10);
    const perPage = Math.min(parseInt(query['perPage'] ?? '20', 10), 100);
    const role = query['role'];

    const result = await userRepository.list({ page, perPage, role });
    return reply.send(result);
  });

  /**
   * GET /api/v1/users/me — kendi profilini görmek (herkes)
   */
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await userRepository.findById(request.user.sub);
    return reply.send({ user });
  });

  /**
   * GET /api/v1/users/:id
   */
  app.get('/:id', {
    preHandler: requirePermission('user', 'read'),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await userRepository.findById(id);
    return reply.send({ user });
  });

  /**
   * POST /api/v1/users
   * admin+
   */
  app.post('/', {
    preHandler: requirePermission('user', 'create'),
  }, async (request, reply) => {
    const result = CreateUserSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten() as Record<string, unknown>);
    }

    const user = await userRepository.create(result.data);
    return reply.status(201).send({ user });
  });

  /**
   * PATCH /api/v1/users/:id
   * admin+ veya kullanıcının kendisi (sadece name/password)
   */
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = UpdateUserSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten() as Record<string, unknown>);
    }

    const { sub: requesterId, role: requesterRole } = request.user;
    const isSelf = requesterId === id;
    const isAdmin = ['admin', 'super_admin'].includes(requesterRole);

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('Cannot update another user\'s profile');
    }

    // Kendi profilini güncelleyen kullanıcı role değiştiremez
    if (isSelf && !isAdmin && result.data.role) {
      throw new ValidationError('Cannot change your own role');
    }

    const user = await userRepository.update(id, result.data);
    return reply.send({ user });
  });
}
