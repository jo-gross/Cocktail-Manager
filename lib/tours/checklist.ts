import type { OnboardingChecklistItem, OnboardingChecklistItemId, OnboardingStatus } from '@lib/network/onboarding';

/** Page that resolves a checklist item (below `/workspaces/<id>/manage`). */
const ITEM_PATHS: Record<OnboardingChecklistItemId, string> = {
  glasses: 'glasses',
  ingredients: 'ingredients',
  cocktails: 'cocktails',
  cards: 'cards',
  prices: 'cocktails',
  guestInfo: 'guest-info',
  team: 'settings/users',
  guestMenu: 'guest-menus',
};

export function checklistItemHref(workspaceId: string, id: OnboardingChecklistItemId): string {
  return `/workspaces/${workspaceId}/manage/${ITEM_PATHS[id] ?? ''}`;
}

/** Done by the data or marked as done by a manager (`skipped` is missing on older servers). */
export function isChecklistItemSettled(item: Pick<OnboardingChecklistItem, 'done' | 'skipped'>): boolean {
  return item.done || item.skipped === true;
}

export interface ChecklistSummary {
  done: number;
  total: number;
  /** First open item (neither done nor skipped), `undefined` when everything is settled. */
  next: OnboardingChecklistItem | undefined;
  complete: boolean;
}

export function summarizeChecklist(items: OnboardingChecklistItem[]): ChecklistSummary {
  // Unknown ids (newer server) are ignored – the client has no label or link for them.
  const known = items.filter((item) => Object.hasOwn(ITEM_PATHS, item.id));
  const done = known.filter(isChecklistItemSettled).length;
  return { done, total: known.length, next: known.find((item) => !isChecklistItemSettled(item)), complete: done === known.length };
}

/** The progress card in the bar view: only after the setup wizard, while items are open and not dismissed. */
export function shouldShowChecklistCard(status: OnboardingStatus | null, dismissed: boolean): boolean {
  if (!status || dismissed || status.setupCompletedAt === null) return false;
  const summary = summarizeChecklist(status.checklist);
  return summary.total > 0 && !summary.complete;
}
