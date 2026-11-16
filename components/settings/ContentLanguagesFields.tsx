import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import type { ContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { AdditionalContentLanguages } from './AdditionalContentLanguages';
import { COMMON_CONTENT_LOCALES, displayName } from './localeOptions';

interface ContentLanguagesFieldsProps {
  value: ContentLocales;
  onChange: (value: ContentLocales) => void;
  /** Prefix for the field ids (unique per page). */
  idPrefix?: string;
}

/** Primary + additional content languages; shared by the language settings and the setup wizard. */
export function ContentLanguagesFields({ value, onChange, idPrefix = 'content-language' }: ContentLanguagesFieldsProps) {
  const { t, i18n } = useTranslation(['settings']);

  const localeOptions = useMemo(() => {
    const all = [...COMMON_CONTENT_LOCALES];
    for (const locale of [value.primary, ...value.additional]) {
      if (!all.includes(locale)) all.push(locale);
    }
    return all;
  }, [value]);

  const languageName = useCallback((code: string) => displayName(code, 'language', i18n.language), [i18n.language]);

  return (
    <>
      <FormField label={t('settings:primaryContentLanguage')} htmlFor={`${idPrefix}-primary`}>
        <Select
          id={`${idPrefix}-primary`}
          aria-describedby={`${idPrefix}-primary-help`}
          value={value.primary}
          onChange={(event) => {
            const primary = event.target.value;
            onChange({ primary, additional: value.additional.filter((locale) => locale !== primary) });
          }}
        >
          {localeOptions.map((locale) => (
            <option key={locale} value={locale}>
              {languageName(locale)} ({locale})
            </option>
          ))}
        </Select>
        <p id={`${idPrefix}-primary-help`} className="mt-1 text-xs text-base-content/60">
          {t('settings:primaryContentLanguageHelp')}
        </p>
      </FormField>

      <FormField label={t('settings:additionalContentLanguages')} htmlFor={`${idPrefix}-additional`}>
        <AdditionalContentLanguages
          inputId={`${idPrefix}-additional`}
          options={localeOptions}
          primary={value.primary}
          value={value.additional}
          languageName={languageName}
          onChange={(additional) => onChange({ ...value, additional })}
        />
      </FormField>
    </>
  );
}
