/**
 * Version-agnostic business logic for audit logs (v1). Same DB query as the
 * legacy handler, but returns clean public DTOs (lib/api/dto/auditLogs.ts) plus
 * a PaginationMeta. Legacy route stays wrapped-but-untouched with its raw shape.
 */
import prisma from '../../../prisma/prisma';
import { toAuditLogDto } from '@lib/api/dto/auditLogs';
import type { Prisma, Workspace } from '@generated/prisma/client';
import type { AuditLogDto } from '@lib/schemas/auditLogs';
import type { PaginationMeta } from '@lib/http/responses';

export async function listAuditLogs(
  workspace: Workspace,
  opts: { entityType?: string; entityId?: string; page: number; limit: number },
): Promise<{ items: AuditLogDto[]; pagination: PaginationMeta }> {
  const where: Prisma.AuditLogWhereInput = { workspaceId: workspace.id };
  if (opts.entityType) where.entityType = opts.entityType;
  if (opts.entityId) where.entityId = opts.entityId;

  const skip = (opts.page - 1) * opts.limit;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
      skip,
    }),
  ]);

  const items = logs.map(toAuditLogDto);

  return {
    items,
    pagination: {
      total,
      list_total: items.length,
      page: opts.page,
      totalPages: Math.ceil(total / opts.limit),
    },
  };
}
