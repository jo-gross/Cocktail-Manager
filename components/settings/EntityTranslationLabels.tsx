import React, { useContext } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { TableCell, TableHeaderCell } from '@components/ui';
import { displayName } from './localeOptions';
import { labelLocales, useContentLocales } from './useContentLocales';

/** Label languages of the current workspace (its content languages, primary first). */
export function useLabelLocales(): string[] {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;
  const contentLocales = useContentLocales(workspaceId);
  return contentLocales ? labelLocales(contentLocales) : [];
}

/** Table header cells for every label language. */
export function EntityTranslationHeaderCells({ locales }: { locales: string[] }) {
  const { i18n } = useTranslation('settings');

  return (
    <>
      {locales.map((locale) => (
        <TableHeaderCell key={locale}>{displayName(locale, 'language', i18n.language)}</TableHeaderCell>
      ))}
    </>
  );
}

interface EntityTranslationCellsProps {
  translationKey: string;
  locales: string[];
}

/** Table body cells showing the stored label per language (no UI-locale fallback). */
export function EntityTranslationCells({ translationKey, locales }: EntityTranslationCellsProps) {
  const userContext = useContext(UserContext);

  return (
    <>
      {locales.map((locale) => {
        const label = (userContext.translations as Record<string, Record<string, string> | undefined> | undefined)?.[locale]?.[translationKey];
        const missing = !label?.trim();

        return (
          <TableCell key={locale} className={missing ? 'text-base-content/50 italic' : undefined}>
            {missing ? '—' : label}
          </TableCell>
        );
      })}
    </>
  );
}
