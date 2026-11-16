import { apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';
import type { OnboardingChecklistItem, OnboardingChecklistItemId, OnboardingDto } from '@lib/schemas/onboarding';

export type { OnboardingChecklistItem, OnboardingChecklistItemId };
export type OnboardingStatus = OnboardingDto;

export { ONBOARDING_CHECKLIST_ITEMS } from '@lib/onboarding/checklistItems';

/** Throws `ApiV1RequestError`; callers treat failures (e.g. 404 on older servers) as "no checklist". */
export function fetchOnboardingStatus(workspaceId: string): Promise<OnboardingStatus> {
  return apiV1Fetch<OnboardingStatus>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/onboarding`);
}

/** Marks the setup wizard as completed (idempotent). */
export function completeOnboarding(workspaceId: string): Promise<OnboardingStatus> {
  return apiV1Mutate<OnboardingStatus>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/onboarding/complete`, 'POST');
}

/** Marks a checklist item as done without doing it (`skipped: true`) or reverts that, for the whole workspace. */
export function setChecklistItemSkipped(workspaceId: string, itemId: OnboardingChecklistItemId, skipped: boolean): Promise<OnboardingStatus> {
  return apiV1Mutate<OnboardingStatus>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/onboarding/checklist/${encodeURIComponent(itemId)}`, 'PUT', {
    skipped,
  });
}
