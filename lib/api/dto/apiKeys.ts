/** Prisma `WorkspaceApiKey` (+permissions, +creator) → clean metadata DTO (never the secret/raw keyId). */
import type { Permission, WorkspaceApiKey } from '@generated/prisma/client';
import type { ApiKeyDto } from '@lib/schemas/apiKeys';

type ApiKeyWithDetails = Pick<WorkspaceApiKey, 'id' | 'name' | 'keyId' | 'revoked' | 'expiresAt' | 'lastUsedAt' | 'createdAt'> & {
  createdByUser: { id: string; name: string | null; email: string | null };
  permissions: { permission: Permission }[];
};

export function toApiKeyDto(key: ApiKeyWithDetails): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyId.substring(0, 8) + '...',
    revoked: key.revoked,
    expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    createdAt: key.createdAt.toISOString(),
    createdBy: { id: key.createdByUser.id, name: key.createdByUser.name, email: key.createdByUser.email },
    permissions: key.permissions.map((p) => p.permission),
  };
}
