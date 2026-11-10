/**
 * "Active card for today" logic shared by the bartender view (client) and guest
 * menus (server). Pure module – no Prisma/React – and timezone aware: the bar day
 * is computed in the workspace timezone (default Europe/Berlin) and starts at the
 * workspace `statisticDayStartTime` ("HH:mm"); times before it belong to the
 * previous bar day.
 */
import { DEFAULT_WORKSPACE_TIMEZONE, parseTimezone } from '@lib/workspace/workspaceLocaleSettings';

export interface BarDayOptions {
  /** IANA time zone; invalid/empty values fall back to Europe/Berlin. */
  timezone?: string | null;
  /** Bar day start as "HH:mm" (workspace setting `statisticDayStartTime`); default "00:00". */
  dayStartTime?: string | null;
}

export interface BarDayNow {
  /** Logical bar-day date as YYYY-MM-DD. */
  date: string;
  /** Weekday of the bar-day date, 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Wall-clock minutes since local midnight in the workspace timezone (0–1439), not shifted by the day start. */
  minutesOfDay: number;
}

/** Minimal card shape needed to pick the active card (works with CardSummaryDto, CardDto and Prisma rows). */
export interface ActiveCardCandidate {
  name: string;
  date?: Date | string | null;
  archived?: boolean;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

function getWallClock(instant: Date, timezone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const part of getFormatter(timezone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = parseInt(part.value, 10);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // Some engines report midnight as 24 even with h23
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Parses "HH:mm" into minutes since midnight; invalid/empty → 0. */
export function parseDayStartMinutes(dayStartTime?: string | null): number {
  if (!dayStartTime) return 0;
  const match = /^(\d{1,2}):(\d{2})/.exec(dayStartTime);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return 0;
  return hours * 60 + minutes;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/** Adds days to a YYYY-MM-DD key (pure calendar arithmetic, no timezone involved). */
function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Current bar day (date + weekday) and wall-clock minutes in the workspace timezone. */
export function getBarDayNow(now: Date, timezone?: string | null, dayStartTime?: string | null): BarDayNow {
  const wall = getWallClock(now, parseTimezone(timezone));
  const minutesOfDay = wall.hour * 60 + wall.minute;
  const calendarDate = toDateKey(wall.year, wall.month, wall.day);
  const date = minutesOfDay < parseDayStartMinutes(dayStartTime) ? addDaysToDateKey(calendarDate, -1) : calendarDate;
  const [year, month, day] = date.split('-').map((v) => parseInt(v, 10));
  return { date, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), minutesOfDay };
}

/** Offset (ms) of the timezone relative to UTC at the given instant. */
function getTimezoneOffsetMs(instant: Date, timezone: string): number {
  const wall = getWallClock(instant, timezone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time in the given timezone to an instant (DST gaps resolve to the later offset). */
export function zonedTimeToUtc(dateKey: string, minutesOfDay: number, timezone?: string | null): Date {
  const tz = parseTimezone(timezone);
  const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
  const wallAsUtc = Date.UTC(year, month - 1, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  let result = wallAsUtc - getTimezoneOffsetMs(new Date(wallAsUtc), tz);
  // Re-evaluate once with the offset valid at the candidate instant (handles DST transitions).
  const offset = getTimezoneOffsetMs(new Date(result), tz);
  result = wallAsUtc - offset;
  return new Date(result);
}

/** Instant at which the next bar day begins (used e.g. for "heute aus" → `unavailableUntil`). */
export function getNextBarDayStart(now: Date, options: BarDayOptions = {}): Date {
  const { date } = getBarDayNow(now, options.timezone, options.dayStartTime);
  return zonedTimeToUtc(addDaysToDateKey(date, 1), parseDayStartMinutes(options.dayStartTime), options.timezone);
}

/** Card dates are stored as UTC midnight, so compare on the UTC date part. */
export function getCardDateKey(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Sort order of the bartender card list for the given bar day (YYYY-MM-DD):
 * undated cards first, then today's cards, then future cards, then past cards;
 * ties are ordered by name. (`findActiveCard` prefers today's card explicitly.)
 */
export function compareCardsForBarDay(a: ActiveCardCandidate, b: ActiveCardCandidate, barDate: string): number {
  const aKey = a.date != undefined ? getCardDateKey(a.date) : undefined;
  const bKey = b.date != undefined ? getCardDateKey(b.date) : undefined;

  if (aKey != undefined && aKey == barDate && bKey != undefined && bKey != barDate) return -1;
  if (aKey != undefined && aKey != barDate && bKey != undefined && bKey == barDate) return 1;
  if (aKey == undefined && bKey != undefined) return -1;
  if (aKey != undefined && bKey == undefined) return 1;

  if (aKey != undefined && bKey != undefined) {
    if (aKey > barDate && bKey <= barDate) return -1;
    if (aKey <= barDate && bKey > barDate) return 1;
  }

  return a.name.localeCompare(b.name);
}

/** Returns a sorted copy of the cards (see `compareCardsForBarDay`). */
export function sortCardsForBarDay<T extends ActiveCardCandidate>(cards: readonly T[], barDate: string): T[] {
  return [...cards].sort((a, b) => compareCardsForBarDay(a, b, barDate));
}

/** Card scheduled for exactly the given bar day (ignores archived cards), or undefined. */
export function findCardForBarDay<T extends ActiveCardCandidate>(cards: readonly T[], barDate: string): T | undefined {
  return cards.find((card) => !card.archived && card.date != undefined && getCardDateKey(card.date) == barDate);
}

/**
 * The card the bartender view shows by default: the card dated for the current bar
 * day, otherwise the first card in bar-day sort order. Archived cards are ignored.
 */
export function findActiveCard<T extends ActiveCardCandidate>(cards: readonly T[], now: Date, options: BarDayOptions = {}): T | undefined {
  const candidates = cards.filter((card) => !card.archived);
  const { date } = getBarDayNow(now, options.timezone ?? DEFAULT_WORKSPACE_TIMEZONE, options.dayStartTime);
  return findCardForBarDay(candidates, date) ?? sortCardsForBarDay(candidates, date)[0];
}
