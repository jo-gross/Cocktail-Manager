/**
 * Zod schemas + ResourceApiDocs for the Audit Logs resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/auditLogs.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { DateTimeString, WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Embedded actor for an audit log entry — the flattened `user` relation, or null. */
export const AuditLogUserDtoSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable().openapi({ description: 'Avatar URL, or null.' }),
  })
  .openapi('AuditLogUser');

/** Public audit log DTO — ISO timestamps, no `workspaceId`/`userId` Prisma-isms. */
export const AuditLogDtoSchema = z
  .object({
    id: z.string(),
    entityType: z.string().openapi({ description: 'Type of the affected entity, e.g. `Glass`.' }),
    entityId: z.string().openapi({ description: 'ID of the affected entity.' }),
    action: z.string().openapi({ description: 'Action performed, e.g. `CREATE`, `UPDATE`, `DELETE`.' }),
    createdAt: DateTimeString,
    user: AuditLogUserDtoSchema.nullable().openapi({ description: 'The acting user, or null if the user was removed.' }),
    changes: z.unknown().nullable().openapi({ description: 'Structured diff of the change, or null.' }),
    snapshot: z.unknown().nullable().openapi({ description: 'Entity snapshot after the change, or null.' }),
    exportData: z.unknown().nullable().openapi({ description: 'Exportable entity payload for restore/download, or null.' }),
  })
  .openapi('AuditLog');

export type AuditLogDto = z.infer<typeof AuditLogDtoSchema>;

export const AuditLogListQuerySchema = z.object({
  entityType: z.string().optional().openapi({ description: 'Filter by entity type, e.g. `Glass`.' }),
  entityId: z.string().optional().openapi({ description: 'Filter by entity ID.' }),
  page: z.coerce.number().int().min(1).default(1).openapi({ description: '1-based page number.' }),
  limit: z.coerce.number().int().min(1).default(50).openapi({ description: 'Items per page.' }),
});

export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>;

export const auditLogsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/audit-logs',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.auditLogsCore],
      summary: 'List audit logs',
      description:
        'List audit log entries of a workspace, newest first. Optionally filtered by entity type/ID. ' +
        'Paginated: the response is a `{ data, pagination }` envelope (not a bare array); `data` holds the `AuditLog[]` page.',
      params: WorkspaceIdParam,
      query: AuditLogListQuerySchema,
      response: z.array(AuditLogDtoSchema),
    },
  },
} satisfies ResourceApiDoc;
