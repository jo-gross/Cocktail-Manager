import 'react';

// Erweiterung des Array-Prototypen
declare global {
  interface Array<T> {
    mapWithFallback<U>(mapFn: (item: T, index: number, array: T[]) => U, fallback: U): U[];
  }
}

Array.prototype.mapWithFallback = function <T, U>(this: T[], mapFn: (item: T, index: number, array: T[]) => U, fallback: U): U[] {
  return this.length > 0 ? this.map(mapFn) : [fallback];
};
