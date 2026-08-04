import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@generated/prisma/client';

const mockPrisma = vi.hoisted(() => ({
  workspace: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  session: {
    findFirst: vi.fn(),
  },
}));

vi.mock('../../../prisma/prisma', () => ({ default: mockPrisma }));
vi.mock('@lib/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}));

vi.mock('../jwtApiKeyMiddleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../jwtApiKeyMiddleware')>();
  return {
    ...actual,
    authenticateApiKey: vi.fn().mockResolvedValue(null),
    checkMasterApiKey: vi.fn().mockReturnValue(false),
  };
});

import { withWorkspacePermission, withWorkspaceSession } from '../authenticationMiddleware';
import { authenticateApiKey, checkMasterApiKey } from '../jwtApiKeyMiddleware';

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: unknown };
}

const workspace = {
  id: 'ws-1',
  name: 'Test',
  users: [{ workspaceId: 'ws-1', userId: 'user-1', role: Role.USER }],
};

describe('authenticationMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkMasterApiKey).mockReturnValue(false);
    vi.mocked(authenticateApiKey).mockResolvedValue(null);
  });

  describe('withWorkspacePermission', () => {
    it('returns 400 when workspaceId is missing', async () => {
      const handler = withWorkspacePermission([Role.USER], 'GLASSES_READ', vi.fn());
      const req = { query: {} } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ message: 'workspaceId is required' });
    });

    it('returns 401 when session auth fails', async () => {
      const handler = withWorkspacePermission([Role.USER], 'GLASSES_READ', vi.fn());
      const req = { query: { workspaceId: 'ws-1' }, headers: {} } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ message: 'not authenticated' });
    });

    it('returns 403 when API key belongs to a different workspace', async () => {
      vi.mocked(authenticateApiKey).mockResolvedValue({
        apiKey: { id: 'k1', keyId: 'key1', name: 'Key', createdByUserId: 'user-1', workspaceId: 'other-ws' } as never,
        workspace: { id: 'other-ws', name: 'Other' } as never,
        permissions: ['GLASSES_READ'],
      });

      const inner = vi.fn();
      const handler = withWorkspacePermission([Role.USER], 'GLASSES_READ', inner);
      const req = { query: { workspaceId: 'ws-1' }, headers: { authorization: 'Bearer token' } } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: 'API key is not valid for this workspace' });
      expect(inner).not.toHaveBeenCalled();
    });

    it('returns 403 when API key lacks required permission', async () => {
      vi.mocked(authenticateApiKey).mockResolvedValue({
        apiKey: { id: 'k1', keyId: 'key1', name: 'Key', createdByUserId: 'user-1', workspaceId: 'ws-1' } as never,
        workspace: { id: 'ws-1', name: 'Test' } as never,
        permissions: ['GLASSES_READ'],
      });

      const inner = vi.fn();
      const handler = withWorkspacePermission([Role.MANAGER], 'GLASSES_CREATE', inner);
      const req = { query: { workspaceId: 'ws-1' }, headers: { authorization: 'Bearer token' } } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: 'API key does not have required permission' });
    });

    it('allows master API key bypass', async () => {
      vi.mocked(checkMasterApiKey).mockReturnValue(true);
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const inner = vi.fn();
      const handler = withWorkspacePermission([Role.ADMIN], 'GLASSES_DELETE', inner);
      const req = { query: { workspaceId: 'ws-1' }, headers: { authorization: 'Bearer master' } } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(inner).toHaveBeenCalled();
    });

    it('allows API key with correct permission', async () => {
      vi.mocked(authenticateApiKey).mockResolvedValue({
        apiKey: { id: 'k1', keyId: 'key1', name: 'Key', createdByUserId: 'user-1', workspaceId: 'ws-1' } as never,
        workspace: { id: 'ws-1', name: 'Test' } as never,
        permissions: ['GLASSES_READ'],
      });

      const inner = vi.fn();
      const handler = withWorkspacePermission([Role.USER], 'GLASSES_READ', inner);
      const req = { query: { workspaceId: 'ws-1' }, headers: { authorization: 'Bearer token' } } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(inner).toHaveBeenCalled();
    });
  });

  describe('withWorkspaceSession', () => {
    it('returns 401 without session (API keys are not accepted)', async () => {
      const handler = withWorkspaceSession([Role.USER], vi.fn());
      const req = { query: { workspaceId: 'ws-1' }, headers: {} } as unknown as NextApiRequest;
      const res = createRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
    });
  });
});
