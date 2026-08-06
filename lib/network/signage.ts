import { apiV1Fetch, apiV1Mutate } from './apiV1';
import type { SignageFormatDto, SignageSettingsUpdateInput, SignageSlideCreateInput, SignageSlideDto, SignageSlidePatchInput } from '@lib/schemas/signage';
import type { DeletionResult } from '@lib/schemas/common';

export function getSignageSettings(
  workspaceId: string | string[],
): Promise<{ landscape?: SignageFormatDto; portrait?: SignageFormatDto } | SignageFormatDto[]> {
  return apiV1Fetch(`/api/v1/workspaces/${workspaceId}/admin/signage`);
}

export function updateSignageSettings(workspaceId: string | string[], body: SignageSettingsUpdateInput): Promise<unknown> {
  return apiV1Mutate(`/api/v1/workspaces/${workspaceId}/admin/signage`, 'PUT', body);
}

export function createSignageSlides(workspaceId: string | string[], body: SignageSlideCreateInput): Promise<SignageSlideDto[]> {
  return apiV1Mutate<SignageSlideDto[]>(`/api/v1/workspaces/${workspaceId}/admin/signage/slides`, 'POST', body);
}

export function patchSignageSlides(workspaceId: string | string[], body: SignageSlidePatchInput): Promise<SignageSlideDto[]> {
  return apiV1Mutate<SignageSlideDto[]>(`/api/v1/workspaces/${workspaceId}/admin/signage/slides`, 'PATCH', body);
}

export function deleteSignageSlide(workspaceId: string | string[], slideId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/admin/signage/slides/${slideId}`, 'DELETE');
}
