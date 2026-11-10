import React from 'react';
import { getIn, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FormControl, Input, Label, LabelText, LabelTextAlt, Skeleton } from '@components/ui';
import type { TranslationsDto } from '@lib/schemas/translations';
import { displayName } from './localeOptions';

/** Label per locale, e.g. `{ de: 'Shaken', en: 'Shake' }`. */
export type LabelValues = Record<string, string>;

/** All stored labels of a translation key (inactive locales are kept in the form but neither shown nor sent). */
export function initialLabelValues(translations: TranslationsDto | undefined, key: string | undefined): LabelValues {
  if (!key || !translations) return {};
  const labels: LabelValues = {};
  for (const [locale, catalog] of Object.entries(translations)) {
    const value = catalog?.[key];
    if (typeof value === 'string') labels[locale] = value;
  }
  return labels;
}

/** Labels to save: only the active label locales, trimmed. */
export function activeLabelValues(labels: LabelValues, locales: string[]): LabelValues {
  return Object.fromEntries(locales.map((locale) => [locale, (labels[locale] ?? '').trim()]));
}

/** Zod schema for the `labels` field: the primary label locale (first entry) is required. */
export function labelValuesSchema(locales: string[], message: string) {
  return z.record(z.string(), z.string()).superRefine((labels, ctx) => {
    const primary = locales[0];
    if (primary && !(labels[primary] ?? '').trim()) {
      ctx.addIssue({ code: 'custom', message, path: [primary] });
    }
  });
}

interface LabelTranslationInputsProps {
  /** Label locales, primary first (see `useLabelLocales`). Empty while loading. */
  locales: string[];
  /** Formik field holding the `LabelValues`. */
  name?: string;
  inputSize?: 'sm' | 'md';
}

/** One input per label language of the workspace; the primary language is required, the others optional. */
export function LabelTranslationInputs({ locales, name = 'labels', inputSize }: LabelTranslationInputsProps) {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { values, errors, touched, submitCount, setFieldValue, setFieldTouched } = useFormikContext<Record<string, unknown>>();
  const labels = (getIn(values, name) as LabelValues | undefined) ?? {};
  const primaryLocale = locales[0];

  if (locales.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-busy>
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {locales.map((locale) => {
        const id = `${name}-${locale}`;
        const value = labels[locale] ?? '';
        const isPrimary = locale === primaryLocale;
        const error = getIn(errors, [name, locale]) as string | undefined;
        const showError = !!error && (submitCount > 0 || !!getIn(touched, [name, locale]));

        return (
          <FormControl key={locale}>
            <Label htmlFor={id} className="flex-row items-center justify-between">
              <LabelText>{displayName(locale, 'language', i18n.language)}</LabelText>
              <LabelTextAlt className="text-error">
                <span>{showError ? error : ''}</span>
                {isPrimary ? <span>{t('common:required')}</span> : null}
              </LabelTextAlt>
            </Label>
            <Input
              id={id}
              name={id}
              lang={locale}
              inputSize={inputSize}
              value={value}
              error={showError}
              aria-invalid={showError || undefined}
              placeholder={isPrimary ? undefined : t('settings:languages.missingLabelHint')}
              onChange={(event) => void setFieldValue(name, { ...labels, [locale]: event.target.value })}
              onBlur={() => void setFieldTouched(`${name}.${locale}`, true)}
            />
          </FormControl>
        );
      })}
    </div>
  );
}
