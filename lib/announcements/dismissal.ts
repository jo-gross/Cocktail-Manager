/**
 * Dismissed announcements of this browser (localStorage). Pure module: the storage is passed in.
 *
 * A dismissal is stored per announcement id and `revision` (hash of level, texts and time window), so a changed
 * announcement shows again. The list is capped; the oldest entries are dropped first.
 */
export const DISMISSED_ANNOUNCEMENTS_STORAGE_KEY = 'cm.dismissedAnnouncements';
const MAX_ENTRIES = 200;

export type DismissalStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface DismissableAnnouncement {
  id: string;
  revision: string;
}

export function dismissalKey(announcement: DismissableAnnouncement): string {
  return `${announcement.id}:${announcement.revision}`;
}

/** Stored dismissal keys; an unreadable or blocked storage counts as "nothing dismissed". */
export function readDismissed(storage: DismissalStorage | null | undefined): string[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DISMISSED_ANNOUNCEMENTS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

/** Adds `announcement` to the dismissed keys, stores them and returns the new list. */
export function dismiss(storage: DismissalStorage | null | undefined, announcement: DismissableAnnouncement, dismissed: readonly string[]): string[] {
  const key = dismissalKey(announcement);
  const next = [...dismissed.filter((entry) => entry !== key), key].slice(-MAX_ENTRIES);
  try {
    storage?.setItem(DISMISSED_ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the dismissal lasts until the page is reloaded.
  }
  return next;
}

export function withoutDismissed<T extends DismissableAnnouncement & { dismissible: boolean }>(announcements: readonly T[], dismissed: readonly string[]): T[] {
  return announcements.filter((announcement) => !announcement.dismissible || !dismissed.includes(dismissalKey(announcement)));
}
