import { apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';
import type { GuideProgress, GuideStatus } from '@lib/tours/registry';

/** Tour/checklist progress of the signed-in user. Throws `ApiV1RequestError` (callers fall back to local progress). */
export function fetchGuideProgress(): Promise<GuideProgress[]> {
  return apiV1Fetch<GuideProgress[]>('/api/v1/me/guides');
}

export function updateGuideProgress(guideId: string, body: { status: GuideStatus; version: number }): Promise<GuideProgress> {
  return apiV1Mutate<GuideProgress>(`/api/v1/me/guides/${encodeURIComponent(guideId)}`, 'PUT', body);
}
