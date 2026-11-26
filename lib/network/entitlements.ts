import { apiV1Fetch } from './apiV1';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';

/** Plan, limits and usage of the workspace (`mode: 'off'` on self-hosted instances). */
export function getWorkspaceEntitlement(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceEntitlementDto> {
  return apiV1Fetch<WorkspaceEntitlementDto>(`/api/v1/workspaces/${workspaceId}/entitlement`, { signal });
}
