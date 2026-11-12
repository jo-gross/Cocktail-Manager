import { apiV1Fetch, apiV1Mutate } from './apiV1';
import type {
  SignageFormatDto,
  SignageGuestMenuSlideCreateInput,
  SignageGuestMenuSlideUpdateInput,
  SignageKeyDto,
  SignageSettingsUpdateInput,
  SignageSlideCreateInput,
  SignageSlideDto,
  SignageSlidePatchInput,
} from '@lib/schemas/signage';
import type { DeletionResult } from '@lib/schemas/common';
import type { SignageFormatView } from '@lib/signage/types';

export function getSignageSettings(workspaceId: string | string[]): Promise<SignageFormatDto[]> {
  return apiV1Fetch<SignageFormatDto[]>(`/api/v1/workspaces/${workspaceId}/admin/signage`);
}

/**
 * Signage access tokens (slide id → tokens) for previews of PIN-protected guest menus, from the
 * public monitor feed. Needs the monitor key; without it (or on errors) the map is empty.
 */
export async function getSignagePreviewAccessTokens(workspaceId: string | string[], key: string): Promise<Map<string, string[]>> {
  const response = await fetch(`/api/signage/${workspaceId}?includeInactive=true&key=${encodeURIComponent(key)}`);
  if (!response.ok) return new Map();
  const data = (await response.json()) as { content?: SignageFormatView[] };
  return new Map(
    (data.content ?? [])
      .flatMap((format) => format.slides)
      .filter((slide) => slide.guestMenuAccessTokens && slide.guestMenuAccessTokens.length > 0)
      .map((slide) => [slide.id, slide.guestMenuAccessTokens!]),
  );
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

export function createGuestMenuSignageSlide(workspaceId: string | string[], body: SignageGuestMenuSlideCreateInput): Promise<SignageSlideDto> {
  return apiV1Mutate<SignageSlideDto>(`/api/v1/workspaces/${workspaceId}/admin/signage/slides/guest-menu`, 'POST', body);
}

export function updateGuestMenuSignageSlide(workspaceId: string | string[], slideId: string, body: SignageGuestMenuSlideUpdateInput): Promise<SignageSlideDto> {
  return apiV1Mutate<SignageSlideDto>(`/api/v1/workspaces/${workspaceId}/admin/signage/slides/${slideId}/guest-menu`, 'PATCH', body);
}

export function getSignageKey(workspaceId: string | string[]): Promise<SignageKeyDto> {
  return apiV1Fetch<SignageKeyDto>(`/api/v1/workspaces/${workspaceId}/admin/signage/key`);
}

export function regenerateSignageKey(workspaceId: string | string[]): Promise<SignageKeyDto> {
  return apiV1Mutate<SignageKeyDto>(`/api/v1/workspaces/${workspaceId}/admin/signage/key`, 'POST');
}
