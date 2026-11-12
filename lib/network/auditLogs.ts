import { apiV1FetchPaginatedSafe } from './apiV1';
import { i18n } from '@lib/i18n/client';
import type { AuditLogDto } from '@lib/schemas/auditLogs';
import type { PaginationMeta } from '@lib/http/responses';

export function fetchAuditLogsSafe(
  workspaceId: string | string[] | undefined,
  query: { entityType: string; entityId: string; limit?: number; page?: number },
  setLogs: (logs: AuditLogDto[], pagination: PaginationMeta) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  const params = new URLSearchParams({
    entityType: query.entityType,
    entityId: query.entityId,
    limit: String(query.limit ?? 100),
    page: String(query.page ?? 1),
  });
  apiV1FetchPaginatedSafe<AuditLogDto[]>(`/api/v1/workspaces/${workspaceId}/audit-logs?${params}`, undefined, i18n.t('errors:loadHistory'))
    .then((result) => {
      if (result) setLogs(result.data, result.pagination);
    })
    .finally(() => setLoading(false));
}
