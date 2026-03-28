import type { FastifyRequest } from 'fastify';
import type { AppContext } from '@module-cms/sdk';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// @fastify/jwt ve core auth middleware tarafından eklenir
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
    jwtVerify(): Promise<void>;
  }
}

const EDITOR_ROLES = ['editor', 'admin', 'super_admin'] as const;
const ADMIN_ROLES  = ['admin', 'super_admin']            as const;

/**
 * JWT imzasını doğrular ve kullanıcıyı döner.
 * Token geçersizse Fastify 401 fırlatır.
 */
export async function getVerifiedUser(request: FastifyRequest): Promise<JwtPayload> {
  await request.jwtVerify();
  return request.user;
}

/**
 * Belirtilen rollerden birini gerektiren guard.
 * Permission sistemi de kontrol edilir — ikisinden biri yeterliyse erişim açılır.
 */
export async function requireRole(
  request: FastifyRequest,
  roles: readonly string[],
  ctx: AppContext,
): Promise<void> {
  const user = await getVerifiedUser(request);
  const { allowed } = await ctx.coreApi.checkPermission({
    userId: user.sub,
    resource: 'content',
    action: 'write',
  });
  if (!allowed && !roles.includes(user.role)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
}

export { EDITOR_ROLES, ADMIN_ROLES };
