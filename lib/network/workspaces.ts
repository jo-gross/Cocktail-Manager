import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { WorkspaceDto, WorkspaceSettingsDto, WorkspaceSettingUpdateInput, WorkspaceUpdateInput } from '@lib/schemas/workspace';
import type { TranslationsDto, TranslationUpdateInput } from '@lib/schemas/translations';
import type { DeletionResult } from '@lib/schemas/common';

/** Slim list item from GET /workspaces (collection is not yet a full WorkspaceDto). */
export type WorkspaceListItem = {
  id: string;
  name: string;
  description?: string | null;
};

export function listWorkspaces(): Promise<WorkspaceListItem[]> {
  return apiV1Fetch<WorkspaceListItem[]>('/api/v1/workspaces');
}

export function fetchWorkspacesSafe(
  setWorkspaces: (workspaces: WorkspaceListItem[]) => void,
  setLoading?: (loading: boolean) => void,
  errorMessage = 'Fehler beim Laden der Workspaces',
) {
  setLoading?.(true);
  apiV1FetchSafe<WorkspaceListItem[]>('/api/v1/workspaces', undefined, errorMessage)
    .then((workspaces) => {
      if (workspaces) setWorkspaces(workspaces);
    })
    .finally(() => setLoading?.(false));
}

export function createWorkspace(body: { name: string }): Promise<WorkspaceListItem> {
  return apiV1Mutate<WorkspaceListItem>('/api/v1/workspaces', 'POST', body);
}

export function getWorkspace(workspaceId: string | string[]): Promise<WorkspaceDto> {
  return apiV1Fetch<WorkspaceDto>(`/api/v1/workspaces/${workspaceId}`);
}

export function updateWorkspace(workspaceId: string | string[], body: WorkspaceUpdateInput): Promise<WorkspaceDto> {
  return apiV1Mutate<WorkspaceDto>(`/api/v1/workspaces/${workspaceId}`, 'PUT', body);
}

export function deleteWorkspace(workspaceId: string | string[]): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}`, 'DELETE');
}

export function getWorkspaceSettings(workspaceId: string | string[]): Promise<WorkspaceSettingsDto> {
  return apiV1Fetch<WorkspaceSettingsDto>(`/api/v1/workspaces/${workspaceId}/settings`);
}

export function fetchWorkspaceSettingsSafe(
  workspaceId: string | string[] | undefined,
  setSettings: (settings: WorkspaceSettingsDto) => void,
  errorMessage = 'Fehler beim Laden der Einstellungen',
) {
  if (workspaceId == undefined) return;
  apiV1FetchSafe<WorkspaceSettingsDto>(`/api/v1/workspaces/${workspaceId}/settings`, undefined, errorMessage).then((settings) => {
    if (settings) setSettings(settings);
  });
}

export function updateWorkspaceSetting(workspaceId: string | string[], body: WorkspaceSettingUpdateInput): Promise<WorkspaceSettingsDto> {
  return apiV1Mutate<WorkspaceSettingsDto>(`/api/v1/workspaces/${workspaceId}/settings`, 'PUT', body);
}

export function getTranslations(workspaceId: string | string[]): Promise<TranslationsDto> {
  return apiV1Fetch<TranslationsDto>(`/api/v1/workspaces/${workspaceId}/translations`);
}

export function upsertTranslation(workspaceId: string | string[], body: TranslationUpdateInput): Promise<TranslationsDto> {
  return apiV1Mutate<TranslationsDto>(`/api/v1/workspaces/${workspaceId}/translations`, 'PUT', body);
}
