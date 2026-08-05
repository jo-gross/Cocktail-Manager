import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { QueueItemDto, QueueAddInput, QueueRemoveInput, QueueUpdateInput } from '@lib/schemas/queue';

export function listQueue(workspaceId: string | string[], timestamp?: string): Promise<QueueItemDto[]> {
  const params = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  return apiV1Fetch<QueueItemDto[]>(`/api/v1/workspaces/${workspaceId}/queue${params}`);
}

export function fetchQueueSafe(
  workspaceId: string | string[] | undefined,
  setQueue: (items: QueueItemDto[]) => void,
  setLoading?: (loading: boolean) => void,
  timestamp?: string,
) {
  if (workspaceId == undefined) return;
  setLoading?.(true);
  const params = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  apiV1FetchSafe<QueueItemDto[]>(`/api/v1/workspaces/${workspaceId}/queue${params}`, undefined, 'Fehler beim Laden der Warteschlange')
    .then((items) => {
      if (items) setQueue(items);
    })
    .finally(() => setLoading?.(false));
}

export function addToQueue(workspaceId: string | string[], body: QueueAddInput): Promise<QueueItemDto | QueueItemDto[]> {
  return apiV1Mutate(`/api/v1/workspaces/${workspaceId}/queue/add`, 'POST', body);
}

export function removeFromQueue(workspaceId: string | string[], body: QueueRemoveInput): Promise<{ count: number } | { ok: boolean }> {
  return apiV1Mutate(`/api/v1/workspaces/${workspaceId}/queue/remove`, 'POST', body);
}

export function updateQueueItem(workspaceId: string | string[], queueItemId: string, body: QueueUpdateInput): Promise<QueueItemDto> {
  return apiV1Mutate<QueueItemDto>(`/api/v1/workspaces/${workspaceId}/queue/${queueItemId}`, 'PUT', body);
}
