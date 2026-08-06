import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { ApiKeyDto, ApiKeyCreateInput, ApiKeyCreateResult } from '@lib/schemas/apiKeys';
import type { DeletionResult } from '@lib/schemas/common';

export function listApiKeys(workspaceId: string | string[]): Promise<ApiKeyDto[]> {
  return apiV1Fetch<ApiKeyDto[]>(`/api/v1/workspaces/${workspaceId}/api-keys`);
}

export function fetchApiKeysSafe(workspaceId: string | string[] | undefined, setApiKeys: (keys: ApiKeyDto[]) => void, setLoading: (loading: boolean) => void) {
  if (workspaceId == undefined) return;
  setLoading(true);
  apiV1FetchSafe<ApiKeyDto[]>(`/api/v1/workspaces/${workspaceId}/api-keys`, undefined, 'Fehler beim Laden der API Keys')
    .then((keys) => {
      if (keys) setApiKeys(keys);
    })
    .finally(() => setLoading(false));
}

export function createApiKey(workspaceId: string | string[], body: ApiKeyCreateInput): Promise<ApiKeyCreateResult> {
  return apiV1Mutate<ApiKeyCreateResult>(`/api/v1/workspaces/${workspaceId}/api-keys`, 'POST', body);
}

export function deleteApiKey(workspaceId: string | string[], keyId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/api-keys/${keyId}`, 'DELETE');
}
