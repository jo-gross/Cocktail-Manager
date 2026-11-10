import { apiV1Fetch, apiV1Mutate } from './apiV1';
import type { CocktailGuestInfoResponse, GuestInfoBulkUpdateInput, GuestInfoOverview } from '@lib/schemas/guestInfo';

export function getCocktailGuestInfo(workspaceId: string | string[], cocktailId: string): Promise<CocktailGuestInfoResponse> {
  return apiV1Fetch<CocktailGuestInfoResponse>(`/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}/guest-info`);
}

export function getGuestInfoOverview(workspaceId: string | string[]): Promise<GuestInfoOverview> {
  return apiV1Fetch<GuestInfoOverview>(`/api/v1/workspaces/${workspaceId}/guest-info/overview`);
}

export function bulkUpdateGuestInfo(workspaceId: string | string[], body: GuestInfoBulkUpdateInput): Promise<{ ingredients: number; garnishes: number }> {
  return apiV1Mutate<{ ingredients: number; garnishes: number }>(`/api/v1/workspaces/${workspaceId}/guest-info/bulk`, 'PUT', body);
}
