import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { isValidCurrency, isValidTimezone } from '@lib/workspace/workspaceLocaleSettings';
import { isValidDayStart, type LocaleRegionValues, type RegionValues } from '@lib/onboarding/setupWizard';
import { currencyOptions, displayName, timezoneOptions } from './localeOptions';

export type { LocaleRegionValues, RegionValues };

export function isValidRegion(values: LocaleRegionValues & { dayStart?: string }): boolean {
  return isValidTimezone(values.timezone) && isValidCurrency(values.currency) && (values.dayStart === undefined || isValidDayStart(values.dayStart));
}

interface DayStartFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Defaults to the settings label ("Day start time"). */
  label?: string;
  hint?: React.ReactNode;
  className?: string;
}

/** Start of the statistics / bar day; in the settings and next to the business type in the setup wizard. */
export function DayStartField({ id, value, onChange, label, hint, className }: DayStartFieldProps) {
  const { t } = useTranslation(['settings']);
  return (
    <FormField label={label ?? t('settings:dayStartTime')} htmlFor={id} hint={hint} className={className}>
      <Input id={id} type="time" value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}

interface RegionFieldsProps<T extends LocaleRegionValues> {
  /** With `dayStart` the day start field is shown as well. */
  value: T;
  onChange: (value: T) => void;
  /** Prefix for the field ids (unique per page). */
  idPrefix?: string;
  /** Extra content below the help text (e.g. the currently saved day start). */
  footnote?: React.ReactNode;
}

/** Timezone, currency and (optionally) the statistics day start; shared by the general settings and the setup wizard. */
export function RegionFields<T extends LocaleRegionValues & { dayStart?: string }>({
  value,
  onChange,
  idPrefix = 'workspace',
  footnote,
}: RegionFieldsProps<T>) {
  const { t, i18n } = useTranslation(['settings']);
  const timezones = useMemo(() => timezoneOptions(value.timezone), [value.timezone]);
  const currencies = useMemo(() => currencyOptions(value.currency), [value.currency]);
  const dayStart = value.dayStart;

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

      {dayStart !== undefined ? (
        <DayStartField id={`${idPrefix}-day-start`} value={dayStart} onChange={(time) => onChange({ ...value, dayStart: time })} />
      ) : null}

      <p className="text-sm text-base-content/70 md:col-span-2">
        {dayStart !== undefined ? `${t('settings:dayStartHelp')} ` : null}
        {t('settings:timezoneHelp')}
      </p>
      {footnote ? <p className="text-xs text-base-content/60 md:col-span-2">{footnote}</p> : null}
    </div>
  );
}
