import { apiV1Fetch } from '@lib/network/apiV1';
import type { OnboardingChecklistItem, OnboardingChecklistItemId, OnboardingDto } from '@lib/schemas/onboarding';

export type { OnboardingChecklistItem, OnboardingChecklistItemId };
export type OnboardingStatus = OnboardingDto;

/** Same ids as `ONBOARDING_CHECKLIST_ITEMS` in @lib/schemas/onboarding (kept here to keep zod out of the page bundle). */
export const ONBOARDING_CHECKLIST_ITEMS: readonly OnboardingChecklistItemId[] = [
  'glasses',
  'ingredients',
  'cocktails',
  'cards',
  'prices',
  'guestInfo',
  'team',
  'guestMenu',
];

/** Throws `ApiV1RequestError`; callers treat failures (e.g. 404 on older servers) as "no checklist". */
export function fetchOnboardingStatus(workspaceId: string): Promise<OnboardingStatus> {
  return apiV1Fetch<OnboardingStatus>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/onboarding`);
}
