import React, { useEffect, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Loading, Skeleton } from '@components/ui';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspaceSetting } from '@lib/network/workspaces';
import { DEFAULT_WORKSPACE_CURRENCY, DEFAULT_WORKSPACE_TIMEZONE, getWorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings';
import { SettingsSection } from './SettingsSection';
import { DEFAULT_DAY_START } from '@lib/onboarding/setupWizard';
import { isValidRegion, RegionFields, type RegionValues } from './RegionFields';

/** Timezone, currency and the statistics day start – they jointly define the "bar day". */
export function WorkspaceRegionSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
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

  const dirty = values.timezone !== saved.timezone || values.currency !== saved.currency || values.dayStart !== saved.dayStart;
  useReportUnsavedChanges(dirty);
  const valid = isValidRegion(values);

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
        <RegionFields value={values} onChange={setValues} footnote={t('settings:dayStartCurrent', { time: saved.dayStart })} />
      )}
    </SettingsSection>
  );
}
