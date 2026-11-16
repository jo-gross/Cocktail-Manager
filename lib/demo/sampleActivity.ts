/**
 * Sample activity for fresh demo workspaces, so statistics, ratings and the queue are not
 * empty on the first visit: made cocktails over the last bar days (relative to now, in the
 * workspace timezone and bar day), a few guest ratings and a short queue.
 * `generateSampleActivity` is pure (injectable random); `writeSampleActivityTx` stores it.
 */
import type { Tx } from '@lib/db/tx';
import { getBarDayNow, parseDayStartMinutes, zonedTimeToUtc } from '@lib/cards/activeCard';

export type SampleActionSource = 'CARD' | 'SEARCH_MODAL' | 'DETAIL_MODAL' | 'QUEUE';

export interface SampleActivityInput {
  now: Date;
  timezone?: string | null;
  /** Bar day start "HH:mm" (`statisticDayStartTime`). */
  dayStartTime?: string | null;
  /** Cards in display order with their cocktails; the first one is the bar view's default. */
  cards: Array<{ id: string; cocktailIds: string[] }>;
  /** All available cocktails (also those on no card). */
  cocktailIds: string[];
  /** Language of names and comments. */
  locale: string;
  /** Number of bar days including today (default 14). */
  days?: number;
  /** Random source in [0, 1) (default Math.random). */
  random?: () => number;
}

export interface SampleStatisticItem {
  cocktailId: string;
  cocktailCardId: string | null;
  date: Date;
  actionSource: SampleActionSource;
}

export interface SampleRating {
  cocktailId: string;
  name: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface SampleQueueItem {
  cocktailId: string;
  notes: string | null;
  inProgress: boolean;
  createdAt: Date;
}

export interface SampleActivity {
  statistics: SampleStatisticItem[];
  ratings: SampleRating[];
  queue: SampleQueueItem[];
}

/** Drinks per bar day by weekday (0 = Sunday): quiet at the start of the week, busy on Friday and Saturday. */
const DRINKS_PER_WEEKDAY = [16, 6, 8, 11, 15, 26, 30];

const ACTION_SOURCES: Array<[SampleActionSource, number]> = [
  ['CARD', 0.7],
  ['SEARCH_MODAL', 0.15],
  ['QUEUE', 0.1],
  ['DETAIL_MODAL', 0.05],
];

/** Service starts at 17:00 (or at the bar day start, if later) and ends at 02:00, at the latest just before the next bar day. */
const SERVICE_START_MINUTES = 17 * 60;
const SERVICE_END_MINUTES = 26 * 60;

const RATING_TEXTS: Record<'de' | 'en', { names: string[]; comments: string[] }> = {
  de: {
    names: ['Anna', 'Lukas', 'Mia', 'Jonas', 'Lea', 'Felix', 'Sophie', 'Paul'],
    comments: ['Perfekt ausbalanciert!', 'Sehr erfrischend.', 'Etwas zu süß für mich.', 'Mein neuer Favorit.', 'Schön kalt und frisch.', 'Gerne wieder!'],
  },
  en: {
    names: ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Lucas', 'Mila', 'Leo'],
    comments: ['Perfectly balanced!', 'Very refreshing.', 'A bit too sweet for me.', 'My new favourite.', 'Nice and cold.', 'Would order again!'],
  },
};

const QUEUE_NOTES: Record<'de' | 'en', string> = { de: 'Extra Limette', en: 'Extra lime' };

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((value) => parseInt(value, 10));
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function pickWeighted<T>(entries: Array<[T, number]>, random: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

/** Service window of a bar day in minutes after its calendar midnight (may exceed 24 h). */
export function serviceWindow(dayStartTime?: string | null): { start: number; end: number } {
  const dayStart = parseDayStartMinutes(dayStartTime);
  const start = Math.max(SERVICE_START_MINUTES, dayStart);
  const end = Math.min(SERVICE_END_MINUTES, dayStart + 24 * 60 - 1);
  return { start, end: Math.max(end, start + 60) };
}

/** Instant of a wall-clock time `minutes` after the calendar midnight of `dateKey` (minutes may exceed one day). */
function barTime(dateKey: string, minutes: number, timezone?: string | null): Date {
  const dayOffset = Math.floor(minutes / (24 * 60));
  return zonedTimeToUtc(addDays(dateKey, dayOffset), minutes - dayOffset * 24 * 60, timezone);
}

export function generateSampleActivity(input: SampleActivityInput): SampleActivity {
  const random = input.random ?? Math.random;
  const days = input.days ?? 14;
  const texts = RATING_TEXTS[input.locale === 'de' ? 'de' : 'en'];
  const cocktailIds = [...new Set([...input.cards.flatMap((card) => card.cocktailIds), ...input.cocktailIds])];
  if (cocktailIds.length === 0) return { statistics: [], ratings: [], queue: [] };

  // Popularity: a long tail in random order; cocktails on the default card sell best, those on no card rarely.
  const cardsOf = new Map<string, string[]>();
  input.cards.forEach((card) => card.cocktailIds.forEach((id) => cardsOf.set(id, [...(cardsOf.get(id) ?? []), card.id])));
  const ranked = cocktailIds.map((id) => ({ id, order: random() })).sort((a, b) => a.order - b.order);
  const popularity: Array<[string, number]> = ranked.map(({ id }, rank) => {
    const cards = cardsOf.get(id) ?? [];
    const placement = cards.includes(input.cards[0]?.id ?? '') ? 1 : cards.length > 0 ? 0.8 : 0.2;
    return [id, (placement * (0.7 + random() * 0.6)) / Math.pow(rank + 1, 0.8)];
  });

  const { date: today } = getBarDayNow(input.now, input.timezone, input.dayStartTime);
  const window = serviceWindow(input.dayStartTime);
  const statistics: SampleStatisticItem[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const dateKey = addDays(today, -offset);
    const count = Math.round(DRINKS_PER_WEEKDAY[weekdayOf(dateKey)]! * (0.8 + random() * 0.4));
    for (let i = 0; i < count; i++) {
      // Triangular distribution: the evening peaks in the middle of the service.
      const minutes = Math.floor(window.start + ((random() + random()) / 2) * (window.end - window.start));
      const date = barTime(dateKey, minutes, input.timezone);
      if (date.getTime() > input.now.getTime()) continue;
      const cocktailId = pickWeighted(popularity, random);
      const actionSource = pickWeighted(ACTION_SOURCES, random);
      const cards = cardsOf.get(cocktailId) ?? [];
      // The bar view records the selected card; searches sometimes happen without one.
      const cocktailCardId = actionSource === 'SEARCH_MODAL' && random() < 0.5 ? null : (cards[0] ?? input.cards[0]?.id ?? null);
      statistics.push({ cocktailId, cocktailCardId, date, actionSource });
    }
  }
  statistics.sort((a, b) => a.date.getTime() - b.date.getTime());

  const favourites = [...popularity].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const ratings: SampleRating[] = Array.from({ length: Math.min(6, Math.max(2, favourites.length)) }, (_, index) => {
    const dateKey = addDays(today, -Math.floor(1 + random() * Math.max(1, days - 1)));
    const comment = random() < 0.7 ? texts.comments[index % texts.comments.length]! : null;
    return {
      cocktailId: favourites[index % favourites.length]!,
      name: texts.names[index % texts.names.length]!,
      rating: pickWeighted<number>(
        [
          [5, 0.5],
          [4, 0.35],
          [3, 0.15],
        ],
        random,
      ),
      comment,
      createdAt: barTime(dateKey, Math.floor(window.start + random() * (window.end - window.start)), input.timezone),
    };
  });

  const queue: SampleQueueItem[] = favourites.slice(0, 2).map((cocktailId, index) => ({
    cocktailId,
    notes: index === 1 ? QUEUE_NOTES[input.locale === 'de' ? 'de' : 'en'] : null,
    inProgress: index === 0,
    createdAt: new Date(input.now.getTime() - (index === 0 ? 4 : 1) * 60_000),
  }));

  return { statistics, ratings, queue };
}

/** Generates and stores sample activity for a demo workspace (inside its creation transaction). */
export async function writeSampleActivityTx(
  tx: Tx,
  options: { workspaceId: string; userId: string; locale: string; now?: Date; random?: () => number },
): Promise<SampleActivity> {
  const { workspaceId, userId } = options;
  const [settings, cards, cocktails] = await Promise.all([
    tx.workspaceSetting.findMany({ where: { workspaceId, setting: { in: ['timezone', 'statisticDayStartTime'] } } }),
    tx.cocktailCard.findMany({
      where: { workspaceId, archived: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        groups: { orderBy: { groupNumber: 'asc' }, select: { items: { orderBy: { itemNumber: 'asc' }, select: { cocktailId: true } } } },
      },
    }),
    tx.cocktailRecipe.findMany({ where: { workspaceId, isArchived: false }, select: { id: true } }),
  ]);
  const setting = (key: string) => settings.find((row) => row.setting === key)?.value ?? null;
  const activity = generateSampleActivity({
    now: options.now ?? new Date(),
    timezone: setting('timezone'),
    dayStartTime: setting('statisticDayStartTime'),
    cards: cards.map((card) => ({ id: card.id, cocktailIds: card.groups.flatMap((group) => group.items.map((item) => item.cocktailId)) })),
    cocktailIds: cocktails.map((cocktail) => cocktail.id),
    locale: options.locale,
    random: options.random,
  });

  await tx.cocktailStatisticItem.createMany({ data: activity.statistics.map((item) => ({ ...item, workspaceId, userId })) });
  await tx.cocktailRating.createMany({ data: activity.ratings });
  await tx.cocktailQueue.createMany({ data: activity.queue.map((item) => ({ ...item, workspaceId, updatedAt: item.createdAt })) });
  return activity;
}
