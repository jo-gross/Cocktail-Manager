import type { CSSProperties } from 'react';
import { SignageBackgroundMode } from './types';

export function getSignageContainerStyle(backgroundMode: SignageBackgroundMode, backgroundColor?: string | null): CSSProperties | undefined {
  if (backgroundMode === 'COLOR' && backgroundColor) {
    return { backgroundColor };
  }

  return undefined;
}

export function getSignageContainerClassName(backgroundMode: SignageBackgroundMode, backgroundColor?: string | null, options?: { external?: boolean }): string {
  if (backgroundMode === 'BLURRED') {
    return 'bg-black';
  }

  if (backgroundMode === 'COLOR' && !backgroundColor) {
    return options?.external ? 'bg-black' : 'bg-base-100';
  }

  return '';
}
