/**
 * Version-agnostic business logic for workspace API-key management (v1). Same DB operations,
 * JWT minting and cache invalidation as the legacy handlers, but returns clean DTOs and never
 * leaks the raw keyId. Create/delete are called only from `sessionOnly` routes, so `user` is a
 * real logged-in user (required for the `createdByUserId` FK).
 */
import crypto from 'crypto';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { createApiKeyJwt, invalidateKeyCache } from '@middleware/api/jwtApiKeyMiddleware';
import { toApiKeyDto } from '@lib/api/dto/apiKeys';
import type { Permission, Prisma, User, Workspace } from '@generated/prisma/client';
import type { ApiKeyCreateInput, ApiKeyCreateResult, ApiKeyDto } from '@lib/schemas/apiKeys';

const includeDetails = {
  permissions: true,
  createdByUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkspaceApiKeyInclude;

export async function listApiKeys(workspace: Workspace): Promise<ApiKeyDto[]> {
  const keys = await prisma.workspaceApiKey.findMany({ where: { workspaceId: workspace.id }, include: includeDetails, orderBy: { createdAt: 'desc' } });
  return keys.map(toApiKeyDto);
}

export async function getApiKey(workspace: Workspace, id: string): Promise<ApiKeyDto | null> {
  const key = await prisma.workspaceApiKey.findFirst({ where: { id, workspaceId: workspace.id }, include: includeDetails });
  return key ? toApiKeyDto(key) : null;
}

export async function createApiKey(workspace: Workspace, user: User, input: ApiKeyCreateInput): Promise<ApiKeyCreateResult> {
  const keyId = crypto.randomBytes(16).toString('hex');
  const permissionList: Permission[] = input.permissions ?? [];
  const expiresAtDate = input.expiresAt ? new Date(input.expiresAt) : null;

  const createdKey = await prisma.workspaceApiKey.create({
    data: {
      name: input.name,
      keyId,
      revoked: false,
      expiresAt: expiresAtDate,
      workspaceId: workspace.id,
      createdByUserId: user.id,
      permissions: { create: permissionList.map((permission) => ({ permission })) },
    },
    include: { permissions: true },
  });

  const token = createApiKeyJwt(keyId, workspace.id, permissionList, expiresAtDate);

  return {
    id: createdKey.id,
    name: createdKey.name,
    key: token, // JWT — returned only once.
    expiresAt: createdKey.expiresAt ? createdKey.expiresAt.toISOString() : null,
    createdAt: createdKey.createdAt.toISOString(),
    permissions: createdKey.permissions.map((p) => p.permission),
  };
}

export async function deleteApiKey(workspace: Workspace, id: string): Promise<{ count: number }> {
  const existing = await prisma.workspaceApiKey.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'API key not found');

  await invalidateKeyCache(existing.keyId);
  await prisma.workspaceApiKey.delete({ where: { id } });
  return { count: 1 };
}
