import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// DB mock — unit test
const mockChain = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};
mockChain.from.mockReturnValue(mockChain);
mockChain.where.mockResolvedValue([]);
mockChain.limit.mockResolvedValue([]);

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => mockChain),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sql: Object.assign(vi.fn().mockResolvedValue([]), { end: vi.fn() }),
}));

import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    redis: { on: () => {}, quit: async () => {} } as never,
    jwtSecret: 'test-secret',
  });
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/admin/navigation', () => {
  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/navigation',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/plugins/active', () => {
  it('returns array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plugins/active',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/v1/themes/:name/activate', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/themes/module-theme-core/activate',
    });
    expect(res.statusCode).toBe(401);
  });
});
