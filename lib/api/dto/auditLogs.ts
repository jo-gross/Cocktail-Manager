/**
 * Prisma → public DTO mapping for audit logs. Keeps the /api/v1 contract clean:
 * ISO timestamps, no `workspaceId`/`userId` (implied by the path / embedded user),
 * and the user relation flattened to a small `{ id, name, image }` object.
 * Payload fields (`changes`/`snapshot`/`exportData`) stay as opaque JSON for history UI.
 */
import type { AuditLog, User } from '@generated/prisma/client';
import type { AuditLogDto } from '@lib/schemas/auditLogs';

type AuditLogWithUser = Pick<AuditLog, 'id' | 'entityType' | 'entityId' | 'action' | 'createdAt' | 'changes' | 'snapshot' | 'exportData'> & {
  user: Pick<User, 'id' | 'name' | 'image'> | null;
};

export function toAuditLogDto(log: AuditLogWithUser): AuditLogDto {
  return {
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    user: log.user ? { id: log.user.id, name: log.user.name, image: log.user.image } : null,
    changes: log.changes ?? null,
    snapshot: log.snapshot ?? null,
    exportData: log.exportData ?? null,
  };
}
