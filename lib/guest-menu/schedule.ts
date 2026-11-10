/**
 * Guest menu scheduling (docs/GUEST-MENU-CONCEPT.md → "Mehrere Gästekarten & Zeitsteuerung").
 *
 * Pure module (no Prisma runtime) shared by the public page, the admin API,
 * signage and the builder. All wall-clock values are in the workspace
 * `timezone`; the bar day respects `statisticDayStartTime`.
 *
 * Rules:
 * - Without a time window, `validFrom/validTo/weekdays` are checked against the
 *   *bar day* (e.g. day start 06:00 → Sat 01:00 still counts as Friday).
 * - With a time window (`timeFrom`/`timeTo`, "HH:mm"), the window belongs to the
 *   *calendar* day it starts on. Windows crossing midnight (`22:00–02:00`) are
 *   supported: at 01:00 the window that started yesterday is checked
 *   (yesterday's weekday / date range).
 * - `timeFrom === timeTo` means the whole day; only one bound set = open end.
 */

export interface GuestMenuScheduleFields {
  enabled: boolean;
  /** `validFrom`/`validTo` are `@db.Date` (UTC midnight) or `YYYY-MM-DD` strings; inclusive. */
  validFrom: Date | string | null;
  validTo: Date | string | null;
  /** 0 = Sunday … 6 = Saturday; empty = every day. */
  weekdays: number[];
  timeFrom: string | null;
  timeTo: string | null;
}

export interface ResolvableGuestMenu extends GuestMenuScheduleFields {
  id: string;
  isDefault: boolean;
  priority: number;
  /** Published document; `null`/`undefined` = never published. */
  published?: unknown;
  publishedAt?: Date | string | null;
}

/**
 * "Now" broken down for schedule checks. Compatible with `getBarDayNow` of
 * lib/cards/activeCard.ts (`date`, `weekday`, `minutesOfDay`) plus calendar fields.
 */
export interface ScheduleNow {
  /** Bar day (respects day start), `YYYY-MM-DD`. */
  date: string;
  /** Weekday of the bar day, 0 = Sunday. */
  weekday: number;
  /** Wall-clock minutes since local midnight (0–1439). */
  minutesOfDay: number;
  /** Calendar date in the workspace timezone, `YYYY-MM-DD` (defaults to `date`). */
  calendarDate?: string;
  /** Calendar weekday in the workspace timezone (defaults to `weekday`). */
  calendarWeekday?: number;
}

export interface ScheduleSettings {
  timezone: string;
  /** `statisticDayStartTime` ("HH:mm"), default 00:00. */
  dayStartTime?: string | null;
}

export type MenuValidityReason = 'disabled' | 'unpublished' | 'notYetValid' | 'expired' | 'weekday' | 'time';

export interface MenuValidity {
  valid: boolean;
  /** First failing rule (in the order of the list type), `null` when valid. */
  reason: MenuValidityReason | null;
  /** For notices: "gilt ab" (`YYYY-MM-DD`). */
  startsAt: string | null;
  /** For notices: "galt bis" (`YYYY-MM-DD`). */
  endedAt: string | null;
  weekdays: number[];
  timeFrom: string | null;
  timeTo: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Parses "HH:mm" into minutes since midnight; `null` for empty/invalid values. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) return null;
  return hours * 60 + minutes;
}

/** `Date` (UTC midnight from `@db.Date`) or string → `YYYY-MM-DD`. */
export function toDateKey(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

/** Wall-clock parts of `now` in `timezone`. */
function zonedParts(now: Date, timezone: string): { date: string; weekday: number; minutesOfDay: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(now)) parts[part.type] = part.value;
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutesOfDay: hour * 60 + Number(parts.minute),
  };
}

/**
 * Breaks `now` down in the workspace timezone. The bar day starts at
 * `dayStartTime` – before that, it still counts as the previous day.
 */
export function getScheduleNow(now: Date, settings: ScheduleSettings): ScheduleNow {
  const calendar = zonedParts(now, settings.timezone);
  const dayStart = parseTimeOfDay(settings.dayStartTime) ?? 0;
  const barDate = calendar.minutesOfDay < dayStart ? addDays(calendar.date, -1) : calendar.date;
  return {
    date: barDate,
    weekday: weekdayOf(barDate),
    minutesOfDay: calendar.minutesOfDay,
    calendarDate: calendar.date,
    calendarWeekday: calendar.weekday,
  };
}

/**
 * The day whose date range / weekday rules apply: the bar day without a time
 * window, the calendar day the current window started on otherwise.
 */
function scheduleDay(menu: GuestMenuScheduleFields, now: ScheduleNow): { date: string; weekday: number; inTimeWindow: boolean } {
  const from = parseTimeOfDay(menu.timeFrom);
  const to = parseTimeOfDay(menu.timeTo);
  if (from == null && to == null) return { date: now.date, weekday: now.weekday, inTimeWindow: true };

  const calendarDate = now.calendarDate ?? now.date;
  const calendarWeekday = now.calendarWeekday ?? now.weekday;
  const m = now.minutesOfDay;
  const today = { date: calendarDate, weekday: calendarWeekday };
  const yesterdayDate = addDays(calendarDate, -1);
  const yesterday = { date: yesterdayDate, weekday: weekdayOf(yesterdayDate) };

  if (from != null && to != null) {
    if (from === to) return { ...today, inTimeWindow: true };
    if (from < to) return { ...today, inTimeWindow: m >= from && m < to };
    // Crosses midnight.
    if (m >= from) return { ...today, inTimeWindow: true };
    if (m < to) return { ...yesterday, inTimeWindow: true };
    return { ...today, inTimeWindow: false };
  }
  if (from != null) return { ...today, inTimeWindow: m >= from };
  return { ...today, inTimeWindow: m < (to as number) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detailed validity of a menu at `now` (enabled + schedule; optionally published).
 * `requirePublished` (default false) additionally reports `unpublished`.
 */
export function describeMenuValidity(
  menu: GuestMenuScheduleFields & { published?: unknown },
  now: ScheduleNow,
  options: { requirePublished?: boolean } = {},
): MenuValidity {
  const startsAt = toDateKey(menu.validFrom);
  const endedAt = toDateKey(menu.validTo);
  const base = { startsAt, endedAt, weekdays: [...(menu.weekdays ?? [])].sort((a, b) => a - b), timeFrom: menu.timeFrom ?? null, timeTo: menu.timeTo ?? null };
  const fail = (reason: MenuValidityReason): MenuValidity => ({ valid: false, reason, ...base });

  if (!menu.enabled) return fail('disabled');
  if (options.requirePublished && (menu.published == null || menu.published === false)) return fail('unpublished');

  const day = scheduleDay(menu, now);
  if (startsAt && day.date < startsAt) return fail('notYetValid');
  if (endedAt && day.date > endedAt) return fail('expired');
  if (menu.weekdays && menu.weekdays.length > 0 && !menu.weekdays.includes(day.weekday)) return fail('weekday');
  if (!day.inTimeWindow) return fail('time');
  return { valid: true, reason: null, ...base };
}

/** `enabled` + date range + weekdays + time window (publication is not checked). */
export function isMenuValidNow(menu: GuestMenuScheduleFields, now: ScheduleNow): boolean {
  return describeMenuValidity(menu, now).valid;
}

function isPublished(menu: ResolvableGuestMenu): boolean {
  return menu.published != null && menu.published !== false;
}

/**
 * Spec: enabled + published menus with a matching schedule → lowest `priority`
 * number wins (ties: most recently published, then id); else the enabled +
 * published `isDefault` menu; else `null` ("keine Karte verfügbar").
 */
export function resolveActiveMenu<T extends ResolvableGuestMenu>(menus: readonly T[], now: Date | ScheduleNow, settings?: ScheduleSettings): T | null {
  const scheduleNow = now instanceof Date ? getScheduleNow(now, settings ?? { timezone: 'UTC' }) : now;
  const publishedTime = (menu: T) => (menu.publishedAt ? new Date(menu.publishedAt).getTime() : 0);
  const byPriority = (a: T, b: T) => a.priority - b.priority || publishedTime(b) - publishedTime(a) || a.id.localeCompare(b.id);

  const candidates = menus.filter((menu) => isPublished(menu) && isMenuValidNow(menu, scheduleNow)).sort(byPriority);
  if (candidates.length > 0) return candidates[0];

  const defaults = menus.filter((menu) => menu.isDefault && menu.enabled && isPublished(menu)).sort(byPriority);
  return defaults[0] ?? null;
}
