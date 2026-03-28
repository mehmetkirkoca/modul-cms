import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 gün

function refreshKey(token: string) {
  return `refresh_token:${token}`;
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const refreshTokenStore = {
  async create(redis: Redis, payload: RefreshTokenPayload): Promise<string> {
    const token = randomUUID();
    await redis.setex(refreshKey(token), REFRESH_TOKEN_TTL_SEC, JSON.stringify(payload));
    return token;
  },

  async verify(redis: Redis, token: string): Promise<RefreshTokenPayload | null> {
    const raw = await redis.get(refreshKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as RefreshTokenPayload;
  },

  async revoke(redis: Redis, token: string): Promise<void> {
    await redis.del(refreshKey(token));
  },
};
