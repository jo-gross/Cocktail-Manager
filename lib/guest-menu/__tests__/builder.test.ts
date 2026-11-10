import { describe, expect, it } from 'vitest';
import {
  checkThemeContrast,
  computeScheduleTimeline,
  contrastRatio,
  createBlock,
  createHistory,
  findTimelineOverlaps,
  getTranslationProgress,
  parseHexColor,
  pushHistory,
  redoHistory,
  sectionIdToBlockId,
  setLocalized,
  setOutputVisible,
  toSavableDocument,
  undoHistory,
  type TimelineMenu,
} from '../builder';
import { createDefaultGuestMenuDocument, DEFAULT_THEME, safeParseGuestMenuDocument } from '../schema';

describe('contrast', () => {
  it('parses short and long hex colors', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#00000080')).toEqual([0, 0, 0]);
    expect(parseHexColor('red')).toBeNull();
  });

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#fff', '#fff')).toBe(1);
  });

  it('flags low-contrast theme pairs', () => {
    expect(checkThemeContrast(DEFAULT_THEME.tokens.colors).every((check) => check.ok)).toBe(true);
    const checks = checkThemeContrast({ ...DEFAULT_THEME.tokens.colors, text: '#eeeeee' });
    expect(checks.find((check) => check.id === 'textOnBg')?.ok).toBe(false);
  });
});

describe('translations', () => {
  it('counts missing locales', () => {
    const doc = createDefaultGuestMenuDocument({ locale: 'de', title: 'Karte' });
    doc.blocks.push({ id: 't1', type: 'text', content: { de: 'Hallo', en: 'Hello' } });
    const progress = getTranslationProgress(doc, 'en');
    expect(progress.total).toBe(2);
    expect(progress.translated).toBe(1);
    expect(progress.missing[0].path).toBe('title');
  });

  it('removes empty values', () => {
    expect(setLocalized({ de: 'a', en: 'b' }, 'en', '')).toEqual({ de: 'a' });
  });
});

describe('blocks', () => {
  it('drops incomplete blocks before saving', () => {
    const doc = createDefaultGuestMenuDocument();
    doc.blocks.push(createBlock('image', 'de'));
    expect(safeParseGuestMenuDocument(doc).success).toBe(false);
    expect(safeParseGuestMenuDocument(toSavableDocument(doc)).success).toBe(true);
  });

  it('maps expanded section ids to blocks', () => {
    const doc = { blocks: [createBlock('section', 'de')] };
    const id = doc.blocks[0].id;
    expect(sectionIdToBlockId(id, doc)).toBe(id);
    expect(sectionIdToBlockId(`${id}:group1`, doc)).toBe(id);
    expect(sectionIdToBlockId('unknown', doc)).toBeNull();
  });

  it('toggles output visibility', () => {
    const block = createBlock('divider', 'de');
    const hidden = setOutputVisible(block, 'print', false);
    expect(hidden.outputs).toEqual({ print: false });
    expect(setOutputVisible(hidden, 'print', true).outputs).toBeUndefined();
  });
});

describe('history', () => {
  it('undoes, redoes and merges typing', () => {
    let history = createHistory(1);
    history = pushHistory(history, 2, 'a', 0);
    history = pushHistory(history, 3, 'a', 100);
    expect(history.past).toEqual([1]);
    history = pushHistory(history, 4, 'b', 200);
    history = undoHistory(history);
    expect(history.present).toBe(3);
    history = redoHistory(history);
    expect(history.present).toBe(4);
    history = undoHistory(undoHistory(history));
    expect(history.present).toBe(1);
  });
});

describe('schedule timeline', () => {
  const base = {
    enabled: true,
    validFrom: null,
    validTo: null,
    weekdays: [],
    timeFrom: null,
    timeTo: null,
    isPublished: true,
    publishedAt: null,
    isDefault: false,
  };
  const menus: TimelineMenu[] = [
    { ...base, id: 'day', name: 'Day', priority: 1, isDefault: true },
    { ...base, id: 'evening', name: 'Evening', priority: 0, timeFrom: '18:00', timeTo: '02:00' },
  ];

  it('resolves the active menu per slot', () => {
    // 2026-11-13 is a Friday.
    const timeline = computeScheduleTimeline(menus, '2026-11-13', { days: 2 });
    expect(timeline).toHaveLength(2);
    expect(timeline[0].weekday).toBe(5);
    const at = (minutes: number) => timeline[0].slots.find((slot) => slot.minutes === minutes)!;
    expect(at(12 * 60).activeMenuId).toBe('day');
    expect(at(19 * 60).activeMenuId).toBe('evening');
    expect(timeline[1].slots[2].activeMenuId).toBe('evening'); // 01:00 next day, window from yesterday
  });

  it('reports overlaps of scheduled published menus only', () => {
    expect(findTimelineOverlaps(computeScheduleTimeline(menus, '2026-11-13', { days: 1 }), menus)).toEqual([]);
    const withWeekend: TimelineMenu[] = [...menus, { ...base, id: 'weekend', name: 'Weekend', priority: 2, weekdays: [5, 6] }];
    const overlaps = findTimelineOverlaps(computeScheduleTimeline(withWeekend, '2026-11-13', { days: 1 }), withWeekend);
    expect(overlaps.length).toBeGreaterThan(0);
    expect(overlaps[0].winnerId).toBe('evening');
    expect(overlaps.some((overlap) => overlap.from === 18 * 60 && overlap.to === 24 * 60)).toBe(true);
  });
});
