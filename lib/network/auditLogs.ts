import { apiV1FetchSafe } from './apiV1';
import type { AuditLogDto } from '@lib/schemas/auditLogs';

export function fetchAuditLogsSafe(
  workspaceId: string | string[] | undefined,
  query: { entityType: string; entityId: string; limit?: number },
  setLogs: (logs: AuditLogDto[]) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  const params = new URLSearchParams({
    entityType: query.entityType,
    entityId: query.entityId,
    limit: String(query.limit ?? 100),
  });
  apiV1FetchSafe<AuditLogDto[]>(`/api/v1/workspaces/${workspaceId}/audit-logs?${params}`, undefined, 'Fehler beim Laden der Historie')
    .then((logs) => {
      if (logs) setLogs(logs);
    })
    .finally(() => setLoading(false));
}
