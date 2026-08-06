import { apiV1Fetch, apiV1FetchPaginatedSafe, apiV1Mutate } from './apiV1';
import type { CocktailStatisticItemDto } from '@lib/schemas/statistics';
import type { PaginationMeta } from '@lib/http/responses';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchStatisticLogsSafe(
  workspaceId: string | string[] | undefined,
  query: URLSearchParams,
  setItems: (items: CocktailStatisticItemDto[]) => void,
  setPagination: (pagination: PaginationMeta) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  apiV1FetchPaginatedSafe<CocktailStatisticItemDto[]>(`/api/v1/workspaces/${workspaceId}/statistics/logs?${query}`, undefined, 'Fehler beim Laden der Logs')
    .then((result) => {
      if (!result) return;
      setItems(result.data);
      setPagination(result.pagination);
    })
    .finally(() => setLoading(false));
}

export function deleteStatisticLog(workspaceId: string | string[], logId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/statistics/logs/${logId}`, 'DELETE');
}

export function listCocktailStatistics(workspaceId: string | string[], startDate: string, endDate: string): Promise<CocktailStatisticItemDto[]> {
  return apiV1Fetch<CocktailStatisticItemDto[]>(
    `/api/v1/workspaces/${workspaceId}/statistics/cocktails?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  );
}

/** Thin typed wrapper for advanced statistics GETs that return arbitrary JSON payloads. */
export function fetchAdvancedStatistics<T>(workspaceId: string | string[], pathSuffix: string): Promise<T> {
  return apiV1Fetch<T>(`/api/v1/workspaces/${workspaceId}/statistics/advanced/${pathSuffix}`);
}

export function mutateAdvancedStatisticsSet<T>(workspaceId: string | string[], method: 'POST' | 'PUT' | 'DELETE', body?: unknown, setId?: string): Promise<T> {
  const path = setId ? `/api/v1/workspaces/${workspaceId}/statistics/advanced/sets/${setId}` : `/api/v1/workspaces/${workspaceId}/statistics/advanced/sets`;
  return apiV1Mutate<T>(path, method, body);
}
