import { describe, expect, it } from 'vitest';
import { compareCardsForBarDay, findActiveCard, getBarDayNow, getCardDateKey, getNextBarDayStart, parseDayStartMinutes, zonedTimeToUtc } from '../activeCard';

const card = (name: string, date: string | null, archived = false) => ({ name, date: date ? `${date}T00:00:00.000Z` : null, archived });

describe('parseDayStartMinutes', () => {
  it('parses HH:mm and falls back to 0', () => {
    expect(parseDayStartMinutes('18:30')).toBe(18 * 60 + 30);
    expect(parseDayStartMinutes('06:00')).toBe(360);
    expect(parseDayStartMinutes(undefined)).toBe(0);
    expect(parseDayStartMinutes('garbage')).toBe(0);
    expect(parseDayStartMinutes('25:00')).toBe(0);
  });
});

describe('getBarDayNow', () => {
  it('uses the workspace timezone (Europe/Berlin by default)', () => {
    // 2026-11-10 23:30 UTC = 2026-11-11 00:30 in Berlin (CET, +1)
    const now = new Date('2026-11-10T23:30:00.000Z');
    expect(getBarDayNow(now)).toEqual({ date: '2026-11-11', weekday: 3, minutesOfDay: 30 });
    expect(getBarDayNow(now, 'UTC')).toEqual({ date: '2026-11-10', weekday: 2, minutesOfDay: 23 * 60 + 30 });
  });

  it('attributes times before the day start to the previous bar day', () => {
    // 03:00 Berlin on Wed 2026-11-11, bar day starts 06:00 → still Tuesday's bar day
    const now = new Date('2026-11-11T02:00:00.000Z');
    expect(getBarDayNow(now, 'Europe/Berlin', '06:00')).toEqual({ date: '2026-11-10', weekday: 2, minutesOfDay: 180 });
    expect(getBarDayNow(now, 'Europe/Berlin', '00:00').date).toBe('2026-11-11');
  });

  it('handles month and year boundaries', () => {
    const now = new Date('2027-01-01T01:00:00.000Z'); // 02:00 Berlin on Jan 1st
    expect(getBarDayNow(now, 'Europe/Berlin', '05:00')).toMatchObject({ date: '2026-12-31', weekday: 4 });
  });

  it('falls back to Europe/Berlin for invalid timezones', () => {
    const now = new Date('2026-11-10T23:30:00.000Z');
    expect(getBarDayNow(now, 'Not/AZone').date).toBe('2026-11-11');
  });
});

describe('zonedTimeToUtc / getNextBarDayStart', () => {
  it('converts wall-clock time incl. DST', () => {
    expect(zonedTimeToUtc('2026-11-11', 6 * 60, 'Europe/Berlin').toISOString()).toBe('2026-11-11T05:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-01', 6 * 60, 'Europe/Berlin').toISOString()).toBe('2026-07-01T04:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-01', 0, 'America/New_York').toISOString()).toBe('2026-07-01T04:00:00.000Z');
  });

  it('returns the start of the next bar day', () => {
    // 23:00 Berlin on 2026-11-10, day start 06:00 → next bar day starts 2026-11-11 06:00 Berlin
    expect(getNextBarDayStart(new Date('2026-11-10T22:00:00.000Z'), { timezone: 'Europe/Berlin', dayStartTime: '06:00' }).toISOString()).toBe(
      '2026-11-11T05:00:00.000Z',
    );
    // 03:00 Berlin on 2026-11-11 is still the 10th's bar day → next start is the same morning
    expect(getNextBarDayStart(new Date('2026-11-11T02:00:00.000Z'), { timezone: 'Europe/Berlin', dayStartTime: '06:00' }).toISOString()).toBe(
      '2026-11-11T05:00:00.000Z',
    );
    // no day start → next local midnight
    expect(getNextBarDayStart(new Date('2026-11-10T12:00:00.000Z'), { timezone: 'Europe/Berlin' }).toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  it('handles the DST switch night', () => {
    // Berlin switches to CET on 2026-10-25 03:00 CEST → 02:00 CET
    expect(getNextBarDayStart(new Date('2026-10-24T20:00:00.000Z'), { timezone: 'Europe/Berlin', dayStartTime: '06:00' }).toISOString()).toBe(
      '2026-10-25T05:00:00.000Z',
    );
  });
});

describe('getCardDateKey', () => {
  it('uses the UTC date part', () => {
    expect(getCardDateKey('2026-11-10T00:00:00.000Z')).toBe('2026-11-10');
    expect(getCardDateKey(new Date('2026-11-10T00:00:00.000Z'))).toBe('2026-11-10');
  });
});

describe('compareCardsForBarDay', () => {
  it('orders undated, today, future, past, then by name (mirrors the bartender list)', () => {
    const cards = [card('Past', '2026-11-01'), card('Future', '2026-12-01'), card('B undated', null), card('A undated', null), card('Today', '2026-11-10')];
    const sorted = [...cards].sort((a, b) => compareCardsForBarDay(a, b, '2026-11-10')).map((c) => c.name);
    expect(sorted).toEqual(['A undated', 'B undated', 'Today', 'Future', 'Past']);
  });
});

describe('findActiveCard', () => {
  const options = { timezone: 'Europe/Berlin', dayStartTime: '06:00' };

  it('picks the card dated for the current bar day', () => {
    const cards = [card('Standard', null), card('Tuesday', '2026-11-10'), card('Wednesday', '2026-11-11')];
    // 03:00 Berlin on Wednesday → still Tuesday's bar day
    expect(findActiveCard(cards, new Date('2026-11-11T02:00:00.000Z'), options)?.name).toBe('Tuesday');
    // 07:00 Berlin on Wednesday
    expect(findActiveCard(cards, new Date('2026-11-11T06:00:00.000Z'), options)?.name).toBe('Wednesday');
  });

  it('falls back to the first card in bar-day order and ignores archived cards', () => {
    const cards = [card('Old', '2026-01-01'), card('Archived today', '2026-11-10', true), card('Standard', null)];
    expect(findActiveCard(cards, new Date('2026-11-10T18:00:00.000Z'), options)?.name).toBe('Standard');
  });

  it('returns undefined without cards', () => {
    expect(findActiveCard([], new Date(), options)).toBeUndefined();
  });
});
