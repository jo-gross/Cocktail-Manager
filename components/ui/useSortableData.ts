import { useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/** Returns a sorted copy of `rows` using the given key and direction. */
export function sortRows<T>(rows: T[], { key, direction }: SortConfig, getValue?: (row: T, key: string) => unknown): T[] {
  const resolve = getValue ?? ((row: T, sortKey: string) => (row as Record<string, unknown>)[sortKey]);

  return [...rows].sort((a, b) => {
    const cmp = compareValues(resolve(a, key), resolve(b, key));
    return direction === 'asc' ? cmp : -cmp;
  });
}

/** Memoized wrapper around {@link sortRows}. */
export function useSortableData<T>(rows: T[], config: SortConfig, getValue?: (row: T, key: string) => unknown): T[] {
  return useMemo(() => sortRows(rows, config, getValue), [rows, config, getValue]);
}

export function toggleSort(currentKey: string, currentDirection: SortDirection, nextKey: string): { key: string; direction: SortDirection } {
  if (currentKey === nextKey) {
    return { key: nextKey, direction: currentDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { key: nextKey, direction: 'asc' };
}
