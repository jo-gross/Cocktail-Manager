import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { isValidCurrency, isValidTimezone } from '@lib/workspace/workspaceLocaleSettings';
import type { RegionValues } from '@lib/onboarding/setupWizard';
import { currencyOptions, displayName, timezoneOptions } from './localeOptions';

export type { RegionValues };

export function isValidRegion(values: RegionValues): boolean {
  return isValidTimezone(values.timezone) && isValidCurrency(values.currency) && /^\d{2}:\d{2}$/.test(values.dayStart);
}

interface RegionFieldsProps {
  value: RegionValues;
  onChange: (value: RegionValues) => void;
  /** Prefix for the field ids (unique per page). */
  idPrefix?: string;
  /** Extra content below the help text (e.g. the currently saved day start). */
  footnote?: React.ReactNode;
}

/** Timezone, currency and statistics day start; shared by the general settings and the setup wizard. */
export function RegionFields({ value, onChange, idPrefix = 'workspace', footnote }: RegionFieldsProps) {
  const { t, i18n } = useTranslation(['settings']);
  const timezones = useMemo(() => timezoneOptions(value.timezone), [value.timezone]);
  const currencies = useMemo(() => currencyOptions(value.currency), [value.currency]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label={t('settings:timezone')} htmlFor={`${idPrefix}-timezone`}>
        <Select id={`${idPrefix}-timezone`} value={value.timezone} onChange={(event) => onChange({ ...value, timezone: event.target.value })}>
          {timezones.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('settings:currency')} htmlFor={`${idPrefix}-currency`}>
        <Select id={`${idPrefix}-currency`} value={value.currency} onChange={(event) => onChange({ ...value, currency: event.target.value })}>
          {currencies.map((entry) => (
            <option key={entry} value={entry}>
              {entry} – {displayName(entry, 'currency', i18n.language)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('settings:dayStartTime')} htmlFor={`${idPrefix}-day-start`}>
        <Input id={`${idPrefix}-day-start`} type="time" value={value.dayStart} onChange={(event) => onChange({ ...value, dayStart: event.target.value })} />
      </FormField>

      <p className="text-sm text-base-content/70 md:col-span-2">
        {t('settings:dayStartHelp')} {t('settings:timezoneHelp')}
      </p>
      {footnote ? <p className="text-xs text-base-content/60 md:col-span-2">{footnote}</p> : null}
    </div>
  );
}
