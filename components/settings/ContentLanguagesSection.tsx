import React, { useContext, useEffect, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Loading, Skeleton } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspaceSetting } from '@lib/network/workspaces';
import { DEFAULT_CONTENT_LOCALES, getWorkspaceContentLocales, serializeContentLocales, type ContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { ContentLanguagesFields } from './ContentLanguagesFields';
import { SettingsSection } from './SettingsSection';
import { notifyContentLocalesChanged } from './useContentLocales';

/** Primary content language + additional languages that content (cocktails, ingredients, …) can be translated into. */
export function ContentLanguagesSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const { refreshWorkspace } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ContentLocales>(DEFAULT_CONTENT_LOCALES);
  const [contentLocales, setContentLocales] = useState<ContentLocales>(DEFAULT_CONTENT_LOCALES);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (cancelled) return;
        const loaded = getWorkspaceContentLocales(settings);
        setSaved(loaded);
        setContentLocales(loaded);
      })
      .catch((error) => alertApiV1Error(error, t('errors:loadSettings')))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  const dirty = serializeContentLocales(contentLocales) !== serializeContentLocales(saved);
  useReportUnsavedChanges(!loading && dirty);

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await updateWorkspaceSetting(workspaceId, { setting: 'contentLocales', value: serializeContentLocales(contentLocales) });
      setSaved(contentLocales);
      notifyContentLocalesChanged(contentLocales);
      // The translation center and editors read the content languages from the workspace context.
      void refreshWorkspace();
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings:languages.contentTitle')}
      description={t('settings:languages.contentHelp')}
      footer={
        <Button type="button" variant="primary" onClick={save} disabled={loading || saving || !dirty}>
          {saving ? <Loading size="sm" /> : null}
          {t('common:save')}
        </Button>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <ContentLanguagesFields value={contentLocales} onChange={setContentLocales} />
      )}
    </SettingsSection>
  );
}
