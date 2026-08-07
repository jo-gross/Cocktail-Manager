import { i18n } from '@lib/i18n/client';
import { apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { ActionDto, ActionCreateInput, ActionUpdateInput } from '@lib/schemas/actions';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchActions(
  workspaceId: string | string[] | undefined,
  setActions: (actions: ActionDto[]) => void,
  setActionsLoading: (loading: boolean) => void,
  errorMessage = i18n.t('errors:loadActions'),
) {
  if (!workspaceId) return;
  setActionsLoading(true);
  apiV1FetchSafe<ActionDto[]>(`/api/v1/workspaces/${workspaceId}/actions`, undefined, errorMessage)
    .then((actions) => {
      if (actions) setActions(actions);
    })
    .finally(() => {
      setActionsLoading(false);
    });
}

export function createAction(workspaceId: string | string[], body: ActionCreateInput): Promise<ActionDto> {
  return apiV1Mutate<ActionDto>(`/api/v1/workspaces/${workspaceId}/actions`, 'POST', body);
}

export function updateAction(workspaceId: string | string[], actionId: string, body: ActionUpdateInput): Promise<ActionDto> {
  return apiV1Mutate<ActionDto>(`/api/v1/workspaces/${workspaceId}/actions/${actionId}`, 'PUT', body);
}

export function deleteAction(workspaceId: string | string[], actionId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/actions/${actionId}`, 'DELETE');
}
