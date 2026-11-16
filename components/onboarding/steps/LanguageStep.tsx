import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Setting } from '@generated/prisma/client';
import { Button, ButtonGroup, Skeleton } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { ContentLanguagesFields } from '@components/settings/ContentLanguagesFields';
import { isValidRegion, RegionFields } from '@components/settings/RegionFields';
import { notifyContentLocalesChanged } from '@components/settings/useContentLocales';
import { UserContext } from '@lib/context/UserContextProvider';
import { changeAppLanguage } from '@lib/i18n/client';
import { LOCALE_FLAGS, SUPPORTED_LOCALES, type AppLocale } from '@lib/i18n/locales';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspaceSetting } from '@lib/network/workspaces';
import { initialRegionValues, type RegionValues } from '@lib/onboarding/setupWizard';
import { getWorkspaceContentLocales, serializeContentLocales, type ContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import type { WorkspaceSettingsDto } from '@lib/schemas/workspace';
import type { SetupStepProps } from './types';

interface Loaded {
  settings: WorkspaceSettingsDto;
  contentLocales: ContentLocales;
}

function browserDefaults() {
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timezone = undefined;
  }
  const languages = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return { timezone, languages };
}

function initialContentLocales(settings: WorkspaceSettingsDto, fallbackPrimary: string): ContentLocales {
  return settings.contentLocales ? getWorkspaceContentLocales(settings) : { primary: fallbackPrimary, additional: [] };
}

/** Step 1: UI language, content languages, time zone, currency and day start. */
export function LanguageStep({ workspaceId, saveRef, onContentLocaleChange }: SetupStepProps & { onContentLocaleChange: (locale: string) => void }) {
  const { t } = useTranslation(['onboarding', 'settings', 'errors']);
  const userContext = useContext(UserContext);
  const { uiLocale, updateUserSetting, refreshWorkspace } = userContext;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [contentLocales, setContentLocales] = useState<ContentLocales | null>(null);
  // The primary content language follows the UI language until it is changed here.
  const [contentTouched, setContentTouched] = useState(false);
  const [region, setRegion] = useState<RegionValues | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (cancelled) return;
        const initial = initialContentLocales(settings, uiLocale);
        setLoaded({ settings, contentLocales: initial });
        setContentLocales(initial);
        setRegion(initialRegionValues(settings, browserDefaults()));
      })
      .catch((error) => alertApiV1Error(error, t('errors:loadSettings')));
    return () => {
      cancelled = true;
    };
    // Loaded once per visit of the step; later UI language changes must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const chooseUiLanguage = async (locale: AppLocale) => {
    await changeAppLanguage(locale);
    updateUserSetting(Setting.language, locale);
    if (!contentTouched) {
      setContentLocales((previous) => (previous ? { primary: locale, additional: previous.additional.filter((entry) => entry !== locale) } : previous));
    }
  };

  useEffect(() => {
    if (contentLocales) onContentLocaleChange(contentLocales.primary);
  }, [contentLocales, onContentLocaleChange]);

  useEffect(() => {
    saveRef.current = async () => {
      if (!loaded || !contentLocales || !region) return false;
      if (!isValidRegion(region)) return false;
      try {
        const { settings } = loaded;
        const serialized = serializeContentLocales(contentLocales);
        if (settings.contentLocales !== serialized) {
          await updateWorkspaceSetting(workspaceId, { setting: 'contentLocales', value: serialized });
          notifyContentLocalesChanged(contentLocales);
        }
        if (settings.timezone !== region.timezone) await updateWorkspaceSetting(workspaceId, { setting: 'timezone', value: region.timezone });
        if (settings.currency !== region.currency) await updateWorkspaceSetting(workspaceId, { setting: 'currency', value: region.currency });
        if ((settings.statisticDayStartTime ?? null) !== region.dayStart) {
          await updateWorkspaceSetting(workspaceId, { setting: 'statisticDayStartTime', value: region.dayStart });
        }
        const updated = await getWorkspaceSettings(workspaceId);
        setLoaded({ settings: updated, contentLocales });
        await refreshWorkspace();
        return true;
      } catch (error) {
        alertApiV1Error(error, t('errors:save'));
        return false;
      }
    };
  }, [saveRef, loaded, contentLocales, region, workspaceId, refreshWorkspace, t]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title={t('onboarding:language.uiTitle')} description={t('onboarding:language.uiHelp')}>
        <ButtonGroup aria-label={t('settings:language.label')}>
          {SUPPORTED_LOCALES.map((locale) => (
            <Button key={locale} joinItem variant={uiLocale === locale ? 'primary' : 'outline'} onClick={() => void chooseUiLanguage(locale)}>
              <span aria-hidden="true">{LOCALE_FLAGS[locale]}</span> {locale === 'de' ? t('settings:labelDe') : t('settings:labelEn')}
            </Button>
          ))}
        </ButtonGroup>
      </FormSection>

      <FormSection title={t('onboarding:language.contentTitle')} description={t('onboarding:language.contentHelp')}>
        {contentLocales ? (
          <ContentLanguagesFields
            idPrefix="setup-content-language"
            value={contentLocales}
            onChange={(value) => {
              setContentTouched(true);
              setContentLocales(value);
            }}
          />
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </FormSection>

      <FormSection title={t('onboarding:language.regionTitle')} description={t('onboarding:language.regionHelp')}>
        {region ? <RegionFields idPrefix="setup" value={region} onChange={setRegion} /> : <Skeleton className="h-32 w-full" />}
      </FormSection>
    </div>
  );
}
