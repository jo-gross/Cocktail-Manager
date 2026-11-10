import { describe, expect, it } from 'vitest';
import { describeMenuValidity, getScheduleNow, isMenuValidNow, parseTimeOfDay, resolveActiveMenu, type ResolvableGuestMenu } from '../schedule';

const TZ = { timezone: 'Europe/Berlin' };

function menu(overrides: Partial<ResolvableGuestMenu> = {}): ResolvableGuestMenu {
  return {
    id: 'm1',
    enabled: true,
    isDefault: false,
    priority: 0,
    validFrom: null,
    validTo: null,
    weekdays: [],
    timeFrom: null,
    timeTo: null,
    published: { schemaVersion: 1 },
    ...overrides,
  };
}

// 2026-11-13 is a Friday. Berlin is UTC+1 in November.
const fri2000 = new Date('2026-11-13T19:00:00Z'); // Fri 20:00 local
const sat0100 = new Date('2026-11-14T00:00:00Z'); // Sat 01:00 local
const sat0300 = new Date('2026-11-14T02:00:00Z'); // Sat 03:00 local
const sat1200 = new Date('2026-11-14T11:00:00Z'); // Sat 12:00 local

describe('parseTimeOfDay', () => {
  it('parses HH:mm', () => {
    expect(parseTimeOfDay('18:30')).toBe(18 * 60 + 30);
    expect(parseTimeOfDay('24:00')).toBe(1440);
    expect(parseTimeOfDay('25:00')).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
  });
});

describe('getScheduleNow', () => {
  it('uses the workspace timezone', () => {
    const now = getScheduleNow(sat0100, TZ);
    expect(now.calendarDate).toBe('2026-11-14');
    expect(now.calendarWeekday).toBe(6);
    expect(now.minutesOfDay).toBe(60);
    expect(now.date).toBe('2026-11-14');
  });

  it('shifts the bar day before the day start time', () => {
    const now = getScheduleNow(sat0100, { ...TZ, dayStartTime: '06:00' });
    expect(now.date).toBe('2026-11-13');
    expect(now.weekday).toBe(5);
    expect(now.calendarDate).toBe('2026-11-14');
  });
});

describe('isMenuValidNow', () => {
  it('checks weekdays on the bar day without a time window', () => {
    const fridayOnly = menu({ weekdays: [5] });
    expect(isMenuValidNow(fridayOnly, getScheduleNow(sat0100, { ...TZ, dayStartTime: '06:00' }))).toBe(true);
    expect(isMenuValidNow(fridayOnly, getScheduleNow(sat0100, TZ))).toBe(false);
  });

  it('supports time windows crossing midnight (belonging to the start day)', () => {
    const fridayNight = menu({ weekdays: [5], timeFrom: '18:00', timeTo: '02:00' });
    expect(isMenuValidNow(fridayNight, getScheduleNow(fri2000, TZ))).toBe(true);
    expect(isMenuValidNow(fridayNight, getScheduleNow(sat0100, TZ))).toBe(true);
    expect(isMenuValidNow(fridayNight, getScheduleNow(sat0300, TZ))).toBe(false);
    expect(isMenuValidNow(fridayNight, getScheduleNow(sat1200, TZ))).toBe(false);
  });

  it('checks simple windows', () => {
    const lunch = menu({ timeFrom: '11:00', timeTo: '14:00' });
    expect(isMenuValidNow(lunch, getScheduleNow(sat1200, TZ))).toBe(true);
    expect(isMenuValidNow(lunch, getScheduleNow(fri2000, TZ))).toBe(false);
  });

  it('checks the inclusive date range', () => {
    const range = menu({ validFrom: new Date('2026-11-14T00:00:00Z'), validTo: '2026-11-14' });
    expect(isMenuValidNow(range, getScheduleNow(sat1200, TZ))).toBe(true);
    expect(isMenuValidNow(range, getScheduleNow(fri2000, TZ))).toBe(false);
  });
});

describe('describeMenuValidity', () => {
  it('reports reasons for notices', () => {
    expect(describeMenuValidity(menu({ enabled: false }), getScheduleNow(fri2000, TZ)).reason).toBe('disabled');
    expect(describeMenuValidity(menu({ published: null }), getScheduleNow(fri2000, TZ), { requirePublished: true }).reason).toBe('unpublished');
    const future = describeMenuValidity(menu({ validFrom: '2026-12-01' }), getScheduleNow(fri2000, TZ));
    expect(future).toMatchObject({ valid: false, reason: 'notYetValid', startsAt: '2026-12-01' });
    const past = describeMenuValidity(menu({ validTo: '2026-11-01' }), getScheduleNow(fri2000, TZ));
    expect(past).toMatchObject({ reason: 'expired', endedAt: '2026-11-01' });
    expect(describeMenuValidity(menu({ weekdays: [1, 0] }), getScheduleNow(fri2000, TZ))).toMatchObject({ reason: 'weekday', weekdays: [0, 1] });
    expect(describeMenuValidity(menu({ timeFrom: '10:00', timeTo: '12:00' }), getScheduleNow(fri2000, TZ)).reason).toBe('time');
  });
});

describe('resolveActiveMenu', () => {
  it('picks the lowest priority number among valid menus', () => {
    const menus = [menu({ id: 'a', priority: 5 }), menu({ id: 'b', priority: 1 }), menu({ id: 'c', priority: 0, enabled: false })];
    expect(resolveActiveMenu(menus, fri2000, TZ)?.id).toBe('b');
  });

  it('ignores unpublished menus', () => {
    const menus = [menu({ id: 'a', priority: 0, published: null }), menu({ id: 'b', priority: 3 })];
    expect(resolveActiveMenu(menus, fri2000, TZ)?.id).toBe('b');
  });

  it('falls back to the default menu, then null', () => {
    const menus = [menu({ id: 'a', weekdays: [1] }), menu({ id: 'def', isDefault: true, weekdays: [1] })];
    expect(resolveActiveMenu(menus, fri2000, TZ)?.id).toBe('def');
    expect(resolveActiveMenu([menu({ id: 'a', weekdays: [1] })], fri2000, TZ)).toBeNull();
    expect(resolveActiveMenu([menu({ id: 'd', isDefault: true, enabled: false })], fri2000, TZ)).toBeNull();
  });
});
