/**
 * Version-agnostic business logic for workspace API-key management (v1). Returns clean DTOs and
 * never leaks the raw keyId. Create/delete are called only from `sessionOnly` ADMIN routes, so
 * `user` is a real logged-in ADMIN/OWNER (required for the `createdByUserId` FK).
 *
 * A key acts as its creator and authenticates only while the creator is still an ADMIN/OWNER of the
 * workspace (jwtApiKeyMiddleware). Every permission scope covers operations an ADMIN may perform,
 * and owner-only operations (owner role management, workspace deletion) never accept API keys, so a
 * key cannot grant more than its creator has.
 */
import crypto from 'crypto';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { runTx } from '@lib/db/tx';
import { createLog } from '@lib/auditLog';
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
  const permissionList: Permission[] = [...new Set(input.permissions ?? [])];
  const expiresAtDate = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAtDate && expiresAtDate <= new Date()) {
    throw new ApiError(400, 'INVALID_EXPIRY', 'The expiry date must be in the future');
  }

  const createdKey = await runTx(async (tx) => {
    const created = await tx.workspaceApiKey.create({
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
    await createLog(tx, workspace.id, user.id, 'WorkspaceApiKey', created.id, 'CREATE', null, {
      name: created.name,
      expiresAt: created.expiresAt?.toISOString() ?? null,
      permissions: permissionList,
    });
    return created;
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

export async function deleteApiKey(workspace: Workspace, user: User, id: string): Promise<{ count: number }> {
  const keyId = await runTx(async (tx) => {
    const existing = await tx.workspaceApiKey.findFirst({ where: { id, workspaceId: workspace.id }, include: { permissions: true } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'API key not found');

    const { count } = await tx.workspaceApiKey.deleteMany({ where: { id, workspaceId: workspace.id } });
    if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
    await createLog(
      tx,
      workspace.id,
      user.id,
      'WorkspaceApiKey',
      existing.id,
      'DELETE',
      { name: existing.name, permissions: existing.permissions.map((p) => p.permission) },
      null,
    );
    return existing.keyId;
  });

  // After commit: a request between delete and invalidation re-reads the DB and finds no key.
  await invalidateKeyCache(keyId);
  return { count: 1 };
}
