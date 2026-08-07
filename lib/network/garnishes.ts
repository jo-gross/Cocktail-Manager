import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import { i18n } from '@lib/i18n/client';
import type { GarnishCreateInput, GarnishDto, GarnishUpdateInput } from '@lib/schemas/garnishes';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchGarnishes(
  workspaceId: string | string[] | undefined,
  setGarnishes: (garnishes: GarnishDto[]) => void,
  setGarnishesLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setGarnishesLoading(true);
  apiV1FetchSafe<GarnishDto[]>(`/api/v1/workspaces/${workspaceId}/garnishes`, undefined, i18n.t('errors:loadGarnishes'))
    .then((garnishes) => {
      if (garnishes) setGarnishes(garnishes);
    })
    .finally(() => setGarnishesLoading(false));
}

export function getGarnish(workspaceId: string | string[], garnishId: string): Promise<GarnishDto> {
  return apiV1Fetch<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes/${garnishId}`);
}

export function createGarnish(workspaceId: string | string[], body: GarnishCreateInput): Promise<GarnishDto> {
  return apiV1Mutate<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes`, 'POST', body);
}

export function updateGarnish(workspaceId: string | string[], garnishId: string, body: GarnishUpdateInput): Promise<GarnishDto> {
  return apiV1Mutate<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes/${garnishId}`, 'PUT', body);
}

export function deleteGarnish(workspaceId: string | string[], garnishId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/garnishes/${garnishId}`, 'DELETE');
}

export function checkGarnishName(workspaceId: string | string[], name: string): Promise<GarnishDto | null> {
  return apiV1Fetch<GarnishDto | null>(`/api/v1/workspaces/${workspaceId}/garnishes/check?name=${encodeURIComponent(name)}`);
}

export function cloneGarnish(workspaceId: string | string[], garnishId: string, name: string): Promise<GarnishDto> {
  return apiV1Mutate<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes/${garnishId}/clone`, 'POST', { name });
}
