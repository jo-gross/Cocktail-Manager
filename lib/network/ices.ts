import { apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { IceDto, IceCreateInput } from '@lib/schemas/ices';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchIce(workspaceId: string | string[] | undefined, setIce: (ice: IceDto[]) => void, setIceLoading: (loading: boolean) => void) {
  if (!workspaceId) return;
  setIceLoading(true);
  apiV1FetchSafe<IceDto[]>(`/api/v1/workspaces/${workspaceId}/ice`, undefined, 'Fehler beim Laden der Eis-Optionen')
    .then((ice) => {
      if (ice) setIce(ice);
    })
    .finally(() => setIceLoading(false));
}

export function createIce(workspaceId: string | string[], body: IceCreateInput): Promise<IceDto> {
  return apiV1Mutate<IceDto>(`/api/v1/workspaces/${workspaceId}/ice`, 'POST', body);
}

export function deleteIce(workspaceId: string | string[], iceId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/ice/${iceId}`, 'DELETE');
}
