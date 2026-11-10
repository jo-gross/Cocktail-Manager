import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Tab, Tabs, Textarea, cn } from '@components/ui';
import type { EntityContentTranslations } from './useEntityContentTranslations';

export interface TranslatedFieldTabsProps {
  translations: EntityContentTranslations;
  /** Translatable field name, e.g. `name`, `description`. */
  field: string;
  /** Current primary-language value (shown as placeholder in the other languages). */
  sourceValue?: string | null;
  multiline?: boolean;
  /** The original (primary-language) form field. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Language tabs around a form field: the primary language shows the original
 * field, additional content languages show an input bound to
 * {@link useEntityContentTranslations}. Renders only `children` when the
 * workspace has no additional content languages.
 */
export function TranslatedFieldTabs({ translations, field, sourceValue, multiline = false, children, className }: TranslatedFieldTabsProps) {
  const { t } = useTranslation(['translations']);
  const [activeLocale, setActiveLocale] = useState<string>(translations.primaryLocale);

  if (!translations.enabled) return <>{children}</>;

  const isPrimary = activeLocale === translations.primaryLocale || !translations.locales.includes(activeLocale);
  const hasSource = !!sourceValue && sourceValue.trim() !== '';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Tabs variant="bordered" aria-label={t('translations:fieldTabs.label')}>
        <Tab active={isPrimary} onClick={() => setActiveLocale(translations.primaryLocale)} title={t('translations:fieldTabs.primary')}>
          {translations.primaryLocale.toUpperCase()}
        </Tab>
        {translations.locales.map((locale) => {
          const missing = hasSource && translations.getValue(field, locale).trim() === '';
          return (
            <Tab
              key={locale}
              active={!isPrimary && activeLocale === locale}
              onClick={() => setActiveLocale(locale)}
              title={missing ? t('translations:fieldTabs.missing') : undefined}
            >
              <span className="inline-flex items-center gap-1">
                {locale.toUpperCase()}
                {missing && <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />}
              </span>
            </Tab>
          );
        })}
      </Tabs>
      <div className={cn(!isPrimary && 'hidden')}>{children}</div>
      {!isPrimary &&
        (multiline ? (
          <Textarea
            value={translations.getValue(field, activeLocale)}
            placeholder={sourceValue ?? ''}
            disabled={translations.loading}
            lang={activeLocale}
            rows={4}
            onChange={(event) => translations.setValue(field, activeLocale, event.target.value)}
          />
        ) : (
          <Input
            value={translations.getValue(field, activeLocale)}
            placeholder={sourceValue ?? ''}
            disabled={translations.loading}
            lang={activeLocale}
            autoComplete="off"
            onChange={(event) => translations.setValue(field, activeLocale, event.target.value)}
          />
        ))}
    </div>
  );
}
