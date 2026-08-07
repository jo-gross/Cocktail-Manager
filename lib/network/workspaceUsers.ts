import { apiV1FetchSafe, apiV1Mutate } from './apiV1';
import { i18n } from '@lib/i18n/client';
import type { WorkspaceUserDto } from '@lib/schemas/workspaceUsers';
import type { JoinRequestDto } from '@lib/schemas/joinRequests';
import type { JoinCodeDto, JoinCodeCreateInput } from '@lib/schemas/joinCodes';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchWorkspaceUsers(
  workspaceId: string | string[] | undefined,
  setUsers: (users: WorkspaceUserDto[]) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  apiV1FetchSafe<WorkspaceUserDto[]>(`/api/v1/workspaces/${workspaceId}/users`, undefined, i18n.t('errors:loadUsers'))
    .then((users) => {
      if (users) setUsers(users);
    })
    .finally(() => setLoading(false));
}

export function fetchWorkspaceJoinRequests(
  workspaceId: string | string[] | undefined,
  setJoinRequests: (requests: JoinRequestDto[]) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  apiV1FetchSafe<JoinRequestDto[]>(`/api/v1/workspaces/${workspaceId}/join-requests`, undefined, i18n.t('errors:loadJoinRequests'))
    .then((requests) => {
      if (requests) setJoinRequests(requests);
    })
    .finally(() => setLoading(false));
}

export function withdrawOwnJoinRequest(workspaceId: string | string[]): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/join-requests`, 'DELETE');
}

export function fetchWorkspaceJoinCodes(
  workspaceId: string | string[] | undefined,
  setJoinCodes: (codes: JoinCodeDto[]) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  apiV1FetchSafe<JoinCodeDto[]>(`/api/v1/workspaces/${workspaceId}/join-codes`, undefined, i18n.t('errors:loadJoinCodes'))
    .then((codes) => {
      if (codes) setJoinCodes(codes);
    })
    .finally(() => setLoading(false));
}

export function createJoinCode(workspaceId: string | string[], body: JoinCodeCreateInput): Promise<JoinCodeDto> {
  return apiV1Mutate<JoinCodeDto>(`/api/v1/workspaces/${workspaceId}/join-codes`, 'POST', body);
}

export function deleteJoinCode(workspaceId: string | string[], code: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/join-codes/${code}`, 'DELETE');
}
