import { describe, expect, it } from 'vitest';
import {
  autoColumnCandidates,
  balanceSinglePage,
  chooseBestFit,
  measureFragments,
  paginateMonitorUnits,
  type MonitorFragment,
  type MonitorUnit,
} from '../paginate';

function section(id: string, headerHeight: number, itemHeights: number[]): MonitorUnit[] {
  return [
    { kind: 'sectionHeader', sectionId: id, height: headerHeight },
    ...itemHeights.map((height, index): MonitorUnit => ({ kind: 'item', sectionId: id, itemId: `${id}-${index}`, height })),
  ];
}

function itemIds(fragments: MonitorFragment[]): string[] {
  return fragments.flatMap((fragment) => (fragment.kind === 'section' ? fragment.itemIds : [fragment.blockId]));
}

describe('paginateMonitorUnits', () => {
  it('keeps everything on one page when it fits', () => {
    const units = section('a', 20, [10, 10, 10]);
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 1 });
    expect(pages).toHaveLength(1);
    expect(pages[0].columns).toEqual([[{ kind: 'section', sectionId: 'a', showHeader: true, continued: false, itemIds: ['a-0', 'a-1', 'a-2'] }]]);
  });

  it('returns one empty page for an empty menu', () => {
    expect(paginateMonitorUnits({ units: [], pageHeight: 100, columns: 2 })).toEqual([{ columns: [[]] }]);
  });

  it('never splits items and flows into the next column without repeating the header', () => {
    const units = section('a', 20, [30, 30, 30, 30]);
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 2 });
    expect(pages).toHaveLength(1);
    const [first, second] = pages[0].columns;
    expect(itemIds(first)).toEqual(['a-0', 'a-1']);
    expect(second).toEqual([{ kind: 'section', sectionId: 'a', showHeader: false, continued: true, itemIds: ['a-2', 'a-3'] }]);
    for (const column of pages[0].columns) expect(measureFragments(column, units)).toBeLessThanOrEqual(100);
  });

  it('repeats the section header at the top of a new page', () => {
    const units = section('a', 20, [40, 40, 40]);
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 1 });
    expect(pages).toHaveLength(2);
    expect(pages[1].columns[0]).toEqual([{ kind: 'section', sectionId: 'a', showHeader: true, continued: true, itemIds: ['a-2'] }]);
  });

  it('keeps a section header with its first item', () => {
    const units = [...section('a', 10, [70]), ...section('b', 15, [20])];
    // header b (15) would fit after a (80) but not together with its first item (15 + 20).
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 2 });
    expect(pages).toHaveLength(1);
    expect(pages[0].columns[0]).toHaveLength(1);
    expect(pages[0].columns[1]).toEqual([{ kind: 'section', sectionId: 'b', showHeader: true, continued: false, itemIds: ['b-0'] }]);
  });

  it('places an oversized item alone instead of looping', () => {
    const units = section('a', 10, [500, 10]);
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 1 });
    expect(pages.flatMap((page) => page.columns.flatMap(itemIds))).toEqual(['a-0', 'a-1']);
    expect(pages).toHaveLength(2);
  });

  it('respects the reserve in the last column', () => {
    const units = section('a', 0, [40, 40, 40, 40]);
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 2, lastColumnReserve: 50 });
    expect(itemIds(pages[0].columns[0])).toEqual(['a-0', 'a-1']);
    expect(itemIds(pages[0].columns[1])).toEqual(['a-2']);
    expect(pages).toHaveLength(2);
  });

  it('handles blocks between sections', () => {
    const units: MonitorUnit[] = [
      { kind: 'block', blockId: 'header', height: 50 },
      ...section('a', 10, [30, 30]),
      { kind: 'block', blockId: 'footer', height: 20 },
    ];
    const pages = paginateMonitorUnits({ units, pageHeight: 100, columns: 2 });
    expect(pages).toHaveLength(1);
    expect(itemIds(pages[0].columns[0])).toEqual(['header', 'a-0']);
    expect(itemIds(pages[0].columns[1])).toEqual(['a-1', 'footer']);
  });

  it('keeps every unit exactly once across many pages', () => {
    const units = [...section('a', 12, Array(25).fill(17)), ...section('b', 12, Array(30).fill(23))];
    const pages = paginateMonitorUnits({ units, pageHeight: 150, columns: 3 });
    const ids = pages.flatMap((page) => page.columns.flatMap(itemIds));
    expect(ids).toEqual(units.filter((unit) => unit.kind === 'item').map((unit) => (unit as { itemId: string }).itemId));
    for (const page of pages) {
      expect(page.columns.length).toBeLessThanOrEqual(3);
      for (const column of page.columns) expect(measureFragments(column, units)).toBeLessThanOrEqual(150);
    }
  });
});

describe('balanceSinglePage', () => {
  it('balances columns of a single page', () => {
    const units = section('a', 0, Array(6).fill(10));
    const { pages, columnHeight } = balanceSinglePage({ units, pageHeight: 100, columns: 2 });
    expect(pages).toHaveLength(1);
    expect(columnHeight).toBeLessThan(100);
    expect(itemIds(pages[0].columns[0])).toHaveLength(3);
    expect(itemIds(pages[0].columns[1])).toHaveLength(3);
  });

  it('leaves multi-page layouts unchanged', () => {
    const units = section('a', 0, Array(30).fill(10));
    const { pages, columnHeight } = balanceSinglePage({ units, pageHeight: 100, columns: 2 });
    expect(pages.length).toBeGreaterThan(1);
    expect(columnHeight).toBe(100);
  });
});

describe('chooseBestFit', () => {
  const page = { columns: [[]] };
  it('prefers fewer pages, then larger scale, then fewer columns', () => {
    const best = chooseBestFit([
      { scale: 1, columns: 2, pages: [page, page] },
      { scale: 0.8, columns: 3, pages: [page] },
      { scale: 0.8, columns: 2, pages: [page] },
      { scale: 0.6, columns: 2, pages: [page] },
    ]);
    expect(best).toMatchObject({ scale: 0.8, columns: 2 });
  });

  it('returns null without candidates', () => {
    expect(chooseBestFit([])).toBeNull();
  });
});

describe('autoColumnCandidates', () => {
  it('uses fewer columns in portrait', () => {
    expect(Math.max(...autoColumnCandidates('PORTRAIT'))).toBeLessThan(Math.max(...autoColumnCandidates('LANDSCAPE')));
  });
});
