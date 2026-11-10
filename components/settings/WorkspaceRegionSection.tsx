import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormControl, Input, Label, LabelText, Loading, Select, Skeleton } from '@components/ui';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspaceSetting } from '@lib/network/workspaces';
import {
  DEFAULT_WORKSPACE_CURRENCY,
  DEFAULT_WORKSPACE_TIMEZONE,
  getWorkspaceLocaleSettings,
  isValidCurrency,
  isValidTimezone,
} from '@lib/workspace/workspaceLocaleSettings';
import { SettingsSection } from './SettingsSection';
import { currencyOptions, displayName, timezoneOptions } from './localeOptions';

const DEFAULT_DAY_START = '00:00';

interface RegionValues {
  timezone: string;
  currency: string;
  dayStart: string;
}

/** Timezone, currency and the statistics day start – they jointly define the "bar day". */
export function WorkspaceRegionSection({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation(['settings', 'common', 'errors']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<RegionValues>({ timezone: DEFAULT_WORKSPACE_TIMEZONE, currency: DEFAULT_WORKSPACE_CURRENCY, dayStart: DEFAULT_DAY_START });
  const [values, setValues] = useState<RegionValues>(saved);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (cancelled) return;
        const locale = getWorkspaceLocaleSettings(settings);
        const loaded = { timezone: locale.timezone, currency: locale.currency, dayStart: settings.statisticDayStartTime || DEFAULT_DAY_START };
        setSaved(loaded);
        setValues(loaded);
      })
      .catch((error) => alertApiV1Error(error, t('errors:loadSettings')))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  const timezones = useMemo(() => timezoneOptions(values.timezone), [values.timezone]);
  const currencies = useMemo(() => currencyOptions(values.currency), [values.currency]);

  const dirty = values.timezone !== saved.timezone || values.currency !== saved.currency || values.dayStart !== saved.dayStart;
  const valid = isValidTimezone(values.timezone) && isValidCurrency(values.currency) && /^\d{2}:\d{2}$/.test(values.dayStart);

  const save = async () => {
    if (!dirty || !valid) return;
    setSaving(true);
    try {
      if (values.timezone !== saved.timezone) await updateWorkspaceSetting(workspaceId, { setting: 'timezone', value: values.timezone });
      if (values.currency !== saved.currency) await updateWorkspaceSetting(workspaceId, { setting: 'currency', value: values.currency });
      if (values.dayStart !== saved.dayStart) await updateWorkspaceSetting(workspaceId, { setting: 'statisticDayStartTime', value: values.dayStart });
      setSaved(values);
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings:general.regionTitle')}
      description={t('settings:general.regionHelp')}
      footer={
        <Button type="button" variant="primary" onClick={save} disabled={loading || saving || !dirty || !valid}>
          {saving ? <Loading size="sm" /> : null}
          {t('common:save')}
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <FormControl>
            <Label htmlFor="workspace-timezone">
              <LabelText className="font-semibold">{t('settings:timezone')}</LabelText>
            </Label>
            <Select
              id="workspace-timezone"
              value={values.timezone}
              onChange={(event) => setValues((previous) => ({ ...previous, timezone: event.target.value }))}
            >
              {timezones.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <Label htmlFor="workspace-currency">
              <LabelText className="font-semibold">{t('settings:currency')}</LabelText>
            </Label>
            <Select
              id="workspace-currency"
              value={values.currency}
              onChange={(event) => setValues((previous) => ({ ...previous, currency: event.target.value }))}
            >
              {currencies.map((value) => (
                <option key={value} value={value}>
                  {value} – {displayName(value, 'currency', i18n.language)}
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <Label htmlFor="workspace-day-start">
              <LabelText className="font-semibold">{t('settings:dayStartTime')}</LabelText>
            </Label>
            <Input
              id="workspace-day-start"
              type="time"
              value={values.dayStart}
              onChange={(event) => setValues((previous) => ({ ...previous, dayStart: event.target.value }))}
            />
          </FormControl>

          <p className="text-sm text-base-content/70 md:col-span-2">
            {t('settings:dayStartHelp')} {t('settings:timezoneHelp')}
          </p>
          <p className="text-xs text-base-content/60 md:col-span-2">{t('settings:dayStartCurrent', { time: saved.dayStart })}</p>
        </div>
      )}
    </SettingsSection>
  );
}
