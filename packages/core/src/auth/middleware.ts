import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthError, ForbiddenError } from '../errors/index.js';
import { permissionRepository } from '../db/repositories/permission.repository.js';

export interface JwtPayload {
  sub: string;    // userId
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

/** JWT doğrulama — her authenticated route için kullanılır. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AuthError();
  }
}

/** Belirli bir resource:action için permission kontrolü. */
export function requirePermission(resource: string, action: string) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    await requireAuth(request, _reply);

    const { sub: userId } = request.user;
    const allowed = await permissionRepository.check(userId, resource, action);
    if (!allowed) {
      throw new ForbiddenError(`Permission denied: ${resource}:${action}`);
    }
  };
}

/** Sadece belirli rollere izin ver. */
export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    await requireAuth(request, _reply);
    const { role } = request.user;
    if (!roles.includes(role)) {
      throw new ForbiddenError(`Role '${role}' is not allowed`);
    }
  };
}
