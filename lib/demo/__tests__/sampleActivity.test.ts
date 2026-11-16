import { describe, expect, it } from 'vitest';
import { getBarDayNow } from '@lib/cards/activeCard';
import { generateSampleActivity, serviceWindow, type SampleActivityInput } from '@lib/demo/sampleActivity';

/** Deterministic random source (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const classics = ['gin-tonic', 'negroni', 'margarita', 'daiquiri', 'old-fashioned'];
const summer = ['spritz', 'mojito', 'gin-tonic'];

function input(overrides: Partial<SampleActivityInput> = {}): SampleActivityInput {
  return {
    // Friday 2026-11-13, 21:30 in Berlin.
    now: new Date('2026-11-13T20:30:00Z'),
    timezone: 'Europe/Berlin',
    dayStartTime: '05:00',
    cards: [
      { id: 'card-classics', cocktailIds: classics },
      { id: 'card-summer', cocktailIds: summer },
    ],
    cocktailIds: [...classics, 'spritz', 'mojito', 'off-menu'],
    locale: 'de',
    random: seeded(42),
    ...overrides,
  };
}

function wallClock(date: Date, timezone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
  const value = (type: string) => parseInt(parts.find((part) => part.type === type)!.value, 10);
  return { hour: value('hour') % 24, minute: value('minute') };
}

describe('serviceWindow', () => {
  it('runs from 17:00 until 02:00, but never into the next bar day', () => {
    expect(serviceWindow('05:00')).toEqual({ start: 17 * 60, end: 26 * 60 });
    expect(serviceWindow('00:00')).toEqual({ start: 17 * 60, end: 24 * 60 - 1 });
    expect(serviceWindow(null)).toEqual({ start: 17 * 60, end: 24 * 60 - 1 });
    // A bar day starting late in the evening starts the service with it.
    expect(serviceWindow('19:00').start).toBe(19 * 60);
  });
});

describe('generateSampleActivity', () => {
  it('creates statistics for the last 14 bar days, never in the future and only during service', () => {
    const options = input();
    const { statistics } = generateSampleActivity(options);
    expect(statistics.length).toBeGreaterThan(100);
    const barDays = new Set(statistics.map((item) => getBarDayNow(item.date, 'Europe/Berlin', '05:00').date));
    expect(barDays.size).toBeGreaterThanOrEqual(13);
    expect([...barDays].sort()[0]! >= '2026-10-31').toBe(true);
    for (const item of statistics) {
      expect(item.date.getTime()).toBeLessThanOrEqual(options.now.getTime());
      const { hour } = wallClock(item.date, 'Europe/Berlin');
      expect(hour >= 17 || hour < 2).toBe(true);
    }
    // Sorted by time.
    expect(statistics.map((item) => item.date.getTime())).toEqual([...statistics.map((item) => item.date.getTime())].sort((a, b) => a - b));
  });

  it('keeps the activity of today up to now and is busier on weekends', () => {
    const { statistics } = generateSampleActivity(input());
    const perDay = new Map<string, number>();
    for (const item of statistics) {
      const day = getBarDayNow(item.date, 'Europe/Berlin', '05:00').date;
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    // Saturday vs. Monday of the previous week.
    expect(perDay.get('2026-11-07')!).toBeGreaterThan(perDay.get('2026-11-09') ?? 0);
    // Today (Friday) is only partly over.
    expect(perDay.get('2026-11-13') ?? 0).toBeLessThan(perDay.get('2026-11-06')!);
  });

  it('respects the workspace timezone', () => {
    const { statistics } = generateSampleActivity(input({ timezone: 'America/New_York', dayStartTime: '00:00' }));
    for (const item of statistics) {
      const { hour } = wallClock(item.date, 'America/New_York');
      expect(hour).toBeGreaterThanOrEqual(17);
    }
  });

  it('links card cocktails to their card, uses the known action sources and prefers the default card', () => {
    const { statistics } = generateSampleActivity(input());
    const sources = new Set(statistics.map((item) => item.actionSource));
    expect([...sources].every((source) => ['CARD', 'SEARCH_MODAL', 'DETAIL_MODAL', 'QUEUE'].includes(source))).toBe(true);
    expect(statistics.filter((item) => item.actionSource === 'CARD').length / statistics.length).toBeGreaterThan(0.5);
    for (const item of statistics) {
      if (item.actionSource !== 'CARD') continue;
      if (classics.includes(item.cocktailId)) expect(item.cocktailCardId).toBe('card-classics');
      else if (summer.includes(item.cocktailId)) expect(item.cocktailCardId).toBe('card-summer');
      else expect(item.cocktailCardId).toBe('card-classics');
    }
    const counts = new Map<string, number>();
    for (const item of statistics) counts.set(item.cocktailId, (counts.get(item.cocktailId) ?? 0) + 1);
    const onDefaultCard = classics.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    expect(onDefaultCard).toBeGreaterThan(statistics.length / 2);
    expect(counts.get('off-menu') ?? 0).toBeLessThan(statistics.length / 10);
  });

  it('adds localized ratings and a short queue', () => {
    const options = input({ locale: 'en' });
    const { ratings, queue } = generateSampleActivity(options);
    expect(ratings.length).toBeGreaterThanOrEqual(2);
    for (const rating of ratings) {
      expect(rating.rating).toBeGreaterThanOrEqual(3);
      expect(rating.rating).toBeLessThanOrEqual(5);
      expect(rating.createdAt.getTime()).toBeLessThan(options.now.getTime());
    }
    expect(ratings.map((rating) => rating.name)).toContain('Emma');
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ inProgress: true, notes: null });
    expect(queue[1]).toMatchObject({ inProgress: false, notes: 'Extra lime' });
    expect(queue.every((item) => item.createdAt.getTime() < options.now.getTime())).toBe(true);
    expect(generateSampleActivity(input({ locale: 'de' })).queue[1]!.notes).toBe('Extra Limette');
  });

  it('is deterministic for a given random source and empty without cocktails', () => {
    expect(generateSampleActivity(input({ random: seeded(7) }))).toEqual(generateSampleActivity(input({ random: seeded(7) })));
    expect(generateSampleActivity(input({ cards: [], cocktailIds: [] }))).toEqual({ statistics: [], ratings: [], queue: [] });
  });
});
