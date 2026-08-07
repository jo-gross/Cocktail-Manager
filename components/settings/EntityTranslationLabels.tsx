import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { SUPPORTED_LOCALES, type AppLocale } from '@lib/i18n/locales';
import { TableCell, TableHeaderCell } from '@components/ui';

function localeHeaderKey(locale: AppLocale): 'labelDe' | 'labelEn' {
  return locale === 'en' ? 'labelEn' : 'labelDe';
}

/** Table header cells for every supported entity-label language. */
export function EntityTranslationHeaderCells() {
  const { t } = useTranslation('settings');

  return (
    <>
      {SUPPORTED_LOCALES.map((locale) => (
        <TableHeaderCell key={locale}>{t(localeHeaderKey(locale))}</TableHeaderCell>
      ))}
    </>
  );
}

interface EntityTranslationCellsProps {
  translationKey: string;
}

/** Table body cells showing the stored label per language (no UI-locale fallback). */
export function EntityTranslationCells({ translationKey }: EntityTranslationCellsProps) {
  const userContext = useContext(UserContext);

  return (
    <>
      {SUPPORTED_LOCALES.map((locale) => {
        const label = userContext.translations?.[locale]?.[translationKey];
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

/** Number of language columns rendered by the helpers above. */
export const ENTITY_TRANSLATION_COLUMN_COUNT = SUPPORTED_LOCALES.length;
