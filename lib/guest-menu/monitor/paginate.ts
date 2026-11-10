/**
 * Pure pagination for the monitor output (signage `GUEST_MENU` slides).
 *
 * The menu is measured as a flat list of units (section headers, items, other
 * blocks) in one column of the target column width. Units are then flowed into
 * `columns` columns per page (column by column, top to bottom):
 *
 * - an item is never split; an item taller than a page gets a column of its own
 * - a section header always stays with the section's first item
 * - a section continued on a new page repeats its header (`continued: true`);
 *   a section continued in the next column of the same page does not
 */

export type MonitorUnit =
  | { kind: 'sectionHeader'; sectionId: string; height: number }
  | { kind: 'item'; sectionId: string; itemId: string; height: number }
  | { kind: 'block'; blockId: string; height: number };

export type MonitorFragment =
  { kind: 'section'; sectionId: string; showHeader: boolean; continued: boolean; itemIds: string[] } | { kind: 'block'; blockId: string };

export interface MonitorPage {
  columns: MonitorFragment[][];
}

export interface PaginateInput {
  units: MonitorUnit[];
  /** Available height per column. */
  pageHeight: number;
  columns: number;
  /** Height kept free at the bottom of the last column of every page (e.g. QR code). */
  lastColumnReserve?: number;
}

export function paginateMonitorUnits({ units, pageHeight, columns, lastColumnReserve = 0 }: PaginateInput): MonitorPage[] {
  const columnCount = Math.max(1, Math.floor(columns));
  const headerHeights = new Map<string, number>();
  for (const unit of units) if (unit.kind === 'sectionHeader') headerHeights.set(unit.sectionId, unit.height);

  const pages: MonitorPage[] = [];
  let page: MonitorPage = { columns: [[]] };
  let column = 0;
  let used = 0;

  const capacity = () => (column === columnCount - 1 ? Math.max(0, pageHeight - lastColumnReserve) : pageHeight);
  const current = () => page.columns[column];
  const fits = (height: number) => used === 0 || used + height <= capacity();
  /** Moves to the next column (or page); returns true when a new page was started. */
  const nextColumn = (): boolean => {
    used = 0;
    if (column + 1 < columnCount) {
      column += 1;
      page.columns.push([]);
      return false;
    }
    pages.push(page);
    page = { columns: [[]] };
    column = 0;
    return true;
  };

  for (let index = 0; index < units.length; index++) {
    const unit = units[index];

    if (unit.kind === 'block') {
      if (!fits(unit.height)) nextColumn();
      current().push({ kind: 'block', blockId: unit.blockId });
      used += unit.height;
      continue;
    }

    if (unit.kind === 'sectionHeader') {
      const next = units[index + 1];
      const firstItemHeight = next?.kind === 'item' && next.sectionId === unit.sectionId ? next.height : 0;
      if (!fits(unit.height + firstItemHeight)) nextColumn();
      current().push({ kind: 'section', sectionId: unit.sectionId, showHeader: true, continued: false, itemIds: [] });
      used += unit.height;
      continue;
    }

    // item
    let newPage = false;
    const last = current()[current().length - 1];
    const directlyAfterHeader = last?.kind === 'section' && last.sectionId === unit.sectionId && last.itemIds.length === 0;
    // Never leave a header alone: an oversized first item stays with its header.
    if (!directlyAfterHeader && !fits(unit.height)) newPage = nextColumn();
    const target = current();
    let fragment = target[target.length - 1];
    if (!fragment || fragment.kind !== 'section' || fragment.sectionId !== unit.sectionId) {
      const headerHeight = headerHeights.get(unit.sectionId);
      // Repeat the header at the top of a new page (not when continuing in the next column).
      const repeatHeader = (newPage || (used === 0 && column === 0 && pages.length > 0)) && headerHeight !== undefined;
      fragment = { kind: 'section', sectionId: unit.sectionId, showHeader: repeatHeader, continued: true, itemIds: [] };
      target.push(fragment);
      if (repeatHeader) used += headerHeight;
    }
    fragment.itemIds.push(unit.itemId);
    used += unit.height;
  }

  const hasContent = page.columns.some((col) => col.length > 0);
  if (hasContent || pages.length === 0) pages.push(page);
  return pages;
}

/** Total height of a column's fragments (for tests / balancing). */
export function measureFragments(fragments: MonitorFragment[], units: MonitorUnit[]): number {
  const headers = new Map<string, number>();
  const items = new Map<string, number>();
  const blocks = new Map<string, number>();
  for (const unit of units) {
    if (unit.kind === 'sectionHeader') headers.set(unit.sectionId, unit.height);
    else if (unit.kind === 'item') items.set(unit.itemId, unit.height);
    else blocks.set(unit.blockId, unit.height);
  }
  return fragments.reduce((sum, fragment) => {
    if (fragment.kind === 'block') return sum + (blocks.get(fragment.blockId) ?? 0);
    const header = fragment.showHeader ? (headers.get(fragment.sectionId) ?? 0) : 0;
    return sum + header + fragment.itemIds.reduce((itemSum, id) => itemSum + (items.get(id) ?? 0), 0);
  }, 0);
}

/**
 * Single-page layouts: shrinks the column height as far as the content still
 * fits on one page with the same column count, so columns end up balanced.
 */
export function balanceSinglePage(input: PaginateInput): { pages: MonitorPage[]; columnHeight: number } {
  const initial = paginateMonitorUnits(input);
  if (initial.length !== 1 || input.columns <= 1) return { pages: initial, columnHeight: input.pageHeight };
  const tallest = input.units.reduce((max, unit) => Math.max(max, unit.height), 0);
  let low = Math.max(tallest, 1);
  let high = input.pageHeight;
  let best = { pages: initial, columnHeight: input.pageHeight };
  for (let step = 0; step < 24 && high - low > 1; step++) {
    const mid = (low + high) / 2;
    const reserve = Math.max(0, (input.lastColumnReserve ?? 0) - (input.pageHeight - mid));
    const pages = paginateMonitorUnits({ ...input, pageHeight: mid, lastColumnReserve: reserve });
    if (pages.length === 1) {
      best = { pages, columnHeight: mid };
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

export interface FitCandidate {
  scale: number;
  columns: number;
  pages: MonitorPage[];
}

/**
 * Picks the layout: fewest pages first, then the largest font scale, then the
 * fewest columns. `candidates` are evaluated by the caller (they need DOM
 * measurements per scale/column combination).
 */
export function chooseBestFit(candidates: FitCandidate[]): FitCandidate | null {
  let best: FitCandidate | null = null;
  for (const candidate of candidates) {
    if (
      !best ||
      candidate.pages.length < best.pages.length ||
      (candidate.pages.length === best.pages.length && (candidate.scale > best.scale || (candidate.scale === best.scale && candidate.columns < best.columns)))
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Font scales tried in order (short menus are enlarged, long ones shrink down to 0.6 before paging). */
export const MONITOR_FONT_SCALES = [1.3, 1.15, 1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6] as const;

/** Column counts tried for `columns: 'auto'`. */
export function autoColumnCandidates(format: 'LANDSCAPE' | 'PORTRAIT'): number[] {
  return format === 'PORTRAIT' ? [1, 2] : [2, 3, 4];
}
