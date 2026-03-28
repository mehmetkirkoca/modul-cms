import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userRepository } from '../../db/repositories/user.repository.js';
import { refreshTokenStore } from '../../auth/tokens.js';
import { requireAuth } from '../../auth/middleware.js';
import { AuthError, ValidationError } from '../../errors/index.js';
import type { Redis } from 'ioredis';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance, opts: { redis: Redis }) {
  const { redis } = opts;

  /**
   * POST /api/v1/auth/login
   * Body: { email, password }
   * Response: { accessToken, user }
   * Cookie: refreshToken (HttpOnly)
   */
  app.post('/login', async (request, reply) => {
    const result = LoginSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten() as Record<string, unknown>);
    }

    const { email, password } = result.data;
    const user = await userRepository.verifyPassword(email, password);
    if (!user) throw new AuthError('Invalid email or password');

    const accessToken = await reply.jwtSign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' },
    );

    const refreshToken = await refreshTokenStore.create(redis, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  /**
   * POST /api/v1/auth/refresh
   * Cookie: refreshToken
   * Response: { accessToken }
   */
  app.post('/refresh', async (request, reply) => {
    const token = (request.cookies as Record<string, string>)['refreshToken'];
    if (!token) throw new AuthError('Refresh token missing');

    const payload = await refreshTokenStore.verify(redis, token);
    if (!payload) throw new AuthError('Invalid or expired refresh token');

    const accessToken = await reply.jwtSign(
      { sub: payload.userId, email: payload.email, role: payload.role },
      { expiresIn: '15m' },
    );

    return reply.send({ accessToken });
  });

  /**
   * POST /api/v1/auth/logout
   * Cookie: refreshToken
   */
  app.post('/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = (request.cookies as Record<string, string>)['refreshToken'];
    if (token) await refreshTokenStore.revoke(redis, token);

    reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return reply.send({ success: true });
  });

  /**
   * GET /api/v1/auth/me
   * Authorization: Bearer <accessToken>
   */
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await userRepository.findById(request.user.sub);
    return reply.send({ user });
  });
}
