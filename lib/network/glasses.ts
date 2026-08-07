import { i18n } from '@lib/i18n/client';
import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { GlassCreateInput, GlassDto, GlassUpdateInput } from '@lib/schemas/glasses';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchGlasses(
  workspaceId: string | string[] | undefined,
  setGlasses: (glasses: GlassDto[]) => void,
  setGlassesLoading: (loading: boolean) => void,
  errorMessage = i18n.t('errors:loadGlasses'),
) {
  if (!workspaceId) return;
  setGlassesLoading(true);
  apiV1FetchSafe<GlassDto[]>(`/api/v1/workspaces/${workspaceId}/glasses`, undefined, errorMessage)
    .then((glasses) => {
      if (glasses) setGlasses(glasses);
    })
    .finally(() => setGlassesLoading(false));
}

export function getGlass(workspaceId: string | string[], glassId: string): Promise<GlassDto> {
  return apiV1Fetch<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses/${glassId}`);
}

export function createGlass(workspaceId: string | string[], body: GlassCreateInput): Promise<GlassDto> {
  return apiV1Mutate<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses`, 'POST', body);
}

export function updateGlass(workspaceId: string | string[], glassId: string, body: GlassUpdateInput): Promise<GlassDto> {
  return apiV1Mutate<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses/${glassId}`, 'PUT', body);
}

export function deleteGlass(workspaceId: string | string[], glassId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/glasses/${glassId}`, 'DELETE');
}

export function checkGlassName(workspaceId: string | string[], name: string): Promise<GlassDto | null> {
  return apiV1Fetch<GlassDto | null>(`/api/v1/workspaces/${workspaceId}/glasses/check?name=${encodeURIComponent(name)}`);
}

export function cloneGlass(workspaceId: string | string[], glassId: string, name: string): Promise<GlassDto> {
  return apiV1Mutate<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses/${glassId}/clone`, 'POST', { name });
}

export function getGlassReferences(workspaceId: string | string[], glassId: string): Promise<{ id: string; name: string }[]> {
  return apiV1Fetch<{ id: string; name: string }[]>(`/api/v1/workspaces/${workspaceId}/glasses/${glassId}/references`);
}
