import { useCallback } from 'react';
import type { PublicMenuDto } from '@lib/guest-menu/schema';
import { translateGuestText } from '@lib/guest-menu/render/uiTexts';

/** Guest UI strings for the menu's UI locale (menu `uiTexts` overrides win). Independent of the app i18n. */
export function useGuestText(dto: Pick<PublicMenuDto, 'uiLocale' | 'uiTexts'>) {
  return useCallback(
    (key: string, values?: Record<string, unknown>) => translateGuestText(key, dto.uiLocale, values, dto.uiTexts),
    [dto.uiLocale, dto.uiTexts],
  );
}

export type GuestText = ReturnType<typeof useGuestText>;
