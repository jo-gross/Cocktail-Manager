/**
 * Texts and levels of control plane announcements. Pure module (used by the API schemas and the banner).
 *
 * `title` and `body` are `LocalizedText` objects of the instance API contract: `{ de, en }`, both required and not
 * empty. See docs/INSTANCE-API.md.
 */
export const ANNOUNCEMENT_LEVELS = ['info', 'warning', 'critical'] as const;
export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number];

/** A type alias (not an interface), so it is assignable to Prisma's JSON input. */
export type AnnouncementText = {
  de: string;
  en: string;
};

export function isAnnouncementLevel(value: unknown): value is AnnouncementLevel {
  return (ANNOUNCEMENT_LEVELS as readonly unknown[]).includes(value);
}

/** Text for a UI language (`de`, `en`, also `de-AT`, …); other languages get English. */
export function pickAnnouncementText(text: AnnouncementText, locale: string | null | undefined): string {
  return (locale ?? '').toLowerCase().split('-')[0] === 'de' ? text.de : text.en;
}

/** Reads a stored `{ de, en }` JSON value; `null` for anything else. */
export function readStoredAnnouncementText(value: unknown): AnnouncementText | null {
  if (typeof value !== 'object' || value === null) return null;
  const { de, en } = value as { de?: unknown; en?: unknown };
  if (typeof de !== 'string' || typeof en !== 'string' || de === '' || en === '') return null;
  return { de, en };
}

const LEVEL_ORDER: Record<AnnouncementLevel, number> = { critical: 0, warning: 1, info: 2 };

/** Most severe first, then by id (stable). */
export function compareAnnouncements(a: { level: AnnouncementLevel; id: string }, b: { level: AnnouncementLevel; id: string }): number {
  return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.id.localeCompare(b.id);
}

/** Only info announcements can be dismissed; warnings and critical ones stay until they end. */
export function isDismissible(level: AnnouncementLevel): boolean {
  return level === 'info';
}
