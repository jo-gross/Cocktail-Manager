/**
 * Ids of the onboarding checklist and the `onboardingChecklistSkipped` workspace setting
 * (items a manager marked as done without doing them, e.g. a bar without guest menu).
 * Pure module without zod, shared by schemas, controllers and pages.
 */

export const ONBOARDING_CHECKLIST_ITEMS = ['glasses', 'ingredients', 'cocktails', 'cards', 'prices', 'guestInfo', 'team', 'guestMenu'] as const;

export type OnboardingChecklistItemId = (typeof ONBOARDING_CHECKLIST_ITEMS)[number];

export function isOnboardingChecklistItemId(value: unknown): value is OnboardingChecklistItemId {
  return typeof value === 'string' && (ONBOARDING_CHECKLIST_ITEMS as readonly string[]).includes(value);
}

/** Validator for the setting value (`PUT /settings`, backup import): JSON array of known, unique item ids. */
export function validateChecklistSkippedValue(value: string): string | null {
  const message = `onboardingChecklistSkipped must be a JSON array of unique checklist item ids (${ONBOARDING_CHECKLIST_ITEMS.join(', ')})`;
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return message;
  }
  if (!Array.isArray(json) || !json.every(isOnboardingChecklistItemId) || new Set(json).size !== json.length) return message;
  return null;
}

/** Lenient read: unknown ids (older/newer server) and broken values are ignored. */
export function parseChecklistSkipped(value: string | null | undefined): OnboardingChecklistItemId[] {
  if (!value) return [];
  try {
    const json: unknown = JSON.parse(value);
    if (!Array.isArray(json)) return [];
    return ONBOARDING_CHECKLIST_ITEMS.filter((id) => json.includes(id));
  } catch {
    return [];
  }
}

/** Canonical value (checklist order); `null` clears the setting. */
export function serializeChecklistSkipped(ids: Iterable<OnboardingChecklistItemId>): string | null {
  const set = new Set(ids);
  const ordered = ONBOARDING_CHECKLIST_ITEMS.filter((id) => set.has(id));
  return ordered.length > 0 ? JSON.stringify(ordered) : null;
}
