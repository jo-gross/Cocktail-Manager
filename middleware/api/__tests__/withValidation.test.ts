import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withValidation } from '../withValidation';
import { ApiError } from '@lib/http/ApiError';
import { z } from 'zod';
import type { RouteSpec } from '@lib/openapi/types';
import type { User, Workspace } from '@generated/prisma/client';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: unknown };
}

const mockUser = { id: 'user-1' } as User;
const mockWorkspace = { id: 'ws-1' } as Workspace;

const baseSpec: RouteSpec = {
  roles: ['USER'],
  permission: 'GLASSES_READ',
  tags: [],
  summary: 'test',
  params: z.object({ workspaceId: z.string() }),
  query: z.object({ search: z.string().optional() }),
  body: z.object({ name: z.string().min(1) }),
  response: z.object({ id: z.string() }),
};

describe('withValidation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 VALIDATION_ERROR for invalid params', async () => {
    const handler = withValidation(baseSpec, async () => ({ id: '1' }));
    const req = { query: {}, body: { name: 'x' } } as unknown as NextApiRequest;
    const res = createMockRes();

    await handler(req, res, mockUser, mockWorkspace);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const handler = withValidation(baseSpec, async () => ({ id: '1' }));
    const req = { query: { workspaceId: 'ws-1' }, body: {} } as unknown as NextApiRequest;
    const res = createMockRes();

    await handler(req, res, mockUser, mockWorkspace);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR', message: expect.stringContaining('body') } });
  });

  it('wraps successful handler result in { data } envelope', async () => {
    const handler = withValidation(baseSpec, async () => ({ id: 'glass-1' }));
    const req = { query: { workspaceId: 'ws-1' }, body: { name: 'Tumbler' } } as unknown as NextApiRequest;
    const res = createMockRes();

    await handler(req, res, mockUser, mockWorkspace);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'glass-1' } });
  });

  it('maps ApiError to standardized error envelope', async () => {
    const handler = withValidation(baseSpec, async () => {
      throw new ApiError(404, 'NOT_FOUND', 'Glass not found');
    });
    const req = { query: { workspaceId: 'ws-1' }, body: { name: 'Tumbler' } } as unknown as NextApiRequest;
    const res = createMockRes();

    await handler(req, res, mockUser, mockWorkspace);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Glass not found' } });
  });

  it('returns 500 for unexpected errors', async () => {
    const handler = withValidation(baseSpec, async () => {
      throw new Error('boom');
    });
    const req = { query: { workspaceId: 'ws-1' }, body: { name: 'Tumbler' } } as unknown as NextApiRequest;
    const res = createMockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler(req, res, mockUser, mockWorkspace);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    consoleSpy.mockRestore();
  });
});
