import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// DB mock — unit test
vi.mock('../db/client.js', () => ({
  db:  { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  sql: Object.assign(vi.fn().mockResolvedValue([]), { end: vi.fn() }),
}));

import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
} as unknown as Redis;

const mockPluginRegistry = {
  listLoaded: vi.fn(() => []),
  register: vi.fn(),
  unregister: vi.fn(),
  healthCheck: vi.fn(),
} as unknown as import('../core/plugin-registry/index.js').PluginRegistry;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    redis: mockRedis,
    pluginRegistry: mockPluginRegistry,
    jwtSecret: 'test-secret-min-32-chars-long-here',
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'not-an-email', password: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/users', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
    expect(res.statusCode).toBe(401);
  });
});
