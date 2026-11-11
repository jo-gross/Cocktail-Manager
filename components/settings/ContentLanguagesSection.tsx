import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Loading, Select, Skeleton } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspaceSetting } from '@lib/network/workspaces';
import { DEFAULT_CONTENT_LOCALES, getWorkspaceContentLocales, serializeContentLocales, type ContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { AdditionalContentLanguages } from './AdditionalContentLanguages';
import { SettingsSection } from './SettingsSection';
import { notifyContentLocalesChanged } from './useContentLocales';
import { COMMON_CONTENT_LOCALES, displayName } from './localeOptions';

/** Primary content language + additional languages that content (cocktails, ingredients, …) can be translated into. */
export function ContentLanguagesSection({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation(['settings', 'common', 'errors']);
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

  const localeOptions = useMemo(() => {
    const all = [...COMMON_CONTENT_LOCALES];
    for (const locale of [contentLocales.primary, ...contentLocales.additional]) {
      if (!all.includes(locale)) all.push(locale);
    }
    return all;
  }, [contentLocales]);

  const languageName = useCallback((code: string) => displayName(code, 'language', i18n.language), [i18n.language]);

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
        <>
          <FormField label={t('settings:primaryContentLanguage')} htmlFor="primary-content-language">
            <Select
              id="primary-content-language"
              aria-describedby="primary-content-language-help"
              value={contentLocales.primary}
              onChange={(event) => {
                const primary = event.target.value;
                setContentLocales((previous) => ({ primary, additional: previous.additional.filter((locale) => locale !== primary) }));
              }}
            >
              {localeOptions.map((locale) => (
                <option key={locale} value={locale}>
                  {languageName(locale)} ({locale})
                </option>
              ))}
            </Select>
            <p id="primary-content-language-help" className="mt-1 text-xs text-base-content/60">
              {t('settings:primaryContentLanguageHelp')}
            </p>
          </FormField>

          <FormField label={t('settings:additionalContentLanguages')} htmlFor="additional-content-language">
            <AdditionalContentLanguages
              inputId="additional-content-language"
              options={localeOptions}
              primary={contentLocales.primary}
              value={contentLocales.additional}
              languageName={languageName}
              onChange={(additional) => setContentLocales((previous) => ({ ...previous, additional }))}
            />
          </FormField>
        </>
      )}
    </SettingsSection>
  );
}
