import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGlassMartiniAlt, FaHome, FaUtensils } from 'react-icons/fa';
import { MdCelebration } from 'react-icons/md';
import { Alert, Button, Loading, cn } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { isValidWorkspaceName, WorkspaceNameField } from '@components/settings/WorkspaceNameField';
import { WorkspaceLogoField } from '@components/settings/WorkspaceLogoField';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspace, updateWorkspaceSetting } from '@lib/network/workspaces';
import { BUSINESS_TYPES, suggestedDayStart, type BusinessType } from '@lib/onboarding/setupWizard';
import type { SetupStepProps } from './types';

const BUSINESS_TYPE_ICONS: Record<BusinessType, React.ReactNode> = {
  bar: <FaGlassMartiniAlt />,
  restaurant: <FaUtensils />,
  event: <MdCelebration />,
  private: <FaHome />,
};

interface BasicsStepProps extends SetupStepProps {
  businessType: BusinessType | null;
  onBusinessTypeChange: (type: BusinessType) => void;
}

/** Step 2: name, logo and business type (the type only drives suggestions and is not saved). */
export function BasicsStep({ workspaceId, saveRef, businessType, onBusinessTypeChange }: BasicsStepProps) {
  const { t } = useTranslation(['onboarding', 'settings', 'errors']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const [name, setName] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoKey, setLogoKey] = useState(0);
  const [dayStart, setDayStart] = useState<string | null | undefined>(undefined);
  const [dayStartSaving, setDayStartSaving] = useState(false);
  const currentName = workspace?.name ?? '';
  const value = name ?? currentName;

  useEffect(() => {
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (!cancelled) setDayStart(settings.statisticDayStartTime ?? null);
      })
      .catch(() => {
        if (!cancelled) setDayStart(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    saveRef.current = async () => {
      if (!isValidWorkspaceName(value)) return false;
      const trimmed = value.trim();
      if (trimmed === currentName) return true;
      try {
        await updateWorkspace(workspaceId, { name: trimmed });
        await refreshWorkspace();
        setName(null);
        return true;
      } catch (error) {
        alertApiV1Error(error, t('errors:renameWorkspace'));
        return false;
      }
    };
  }, [saveRef, value, currentName, workspaceId, refreshWorkspace, t]);

  const saveLogo = async (image: string | null) => {
    setLogoBusy(true);
    try {
      await updateWorkspace(workspaceId, { image });
      await refreshWorkspace();
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setLogoBusy(false);
      setLogoKey((key) => key + 1);
    }
  };

  const suggestion = dayStart === undefined ? null : suggestedDayStart(businessType, dayStart);

  const applyDayStart = async (time: string) => {
    setDayStartSaving(true);
    try {
      await updateWorkspaceSetting(workspaceId, { setting: 'statisticDayStartTime', value: time });
      setDayStart(time);
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setDayStartSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <FormSection title={t('onboarding:basics.nameTitle')} description={t('settings:general.nameHelp')}>
        <WorkspaceNameField id="setup-workspace-name" value={value} onChange={setName} />
      </FormSection>

      <FormSection title={t('settings:logo.title')} description={t('settings:logo.help')}>
        <WorkspaceLogoField key={logoKey} image={workspace?.image} name={currentName} disabled={logoBusy} onChange={(image) => void saveLogo(image)} />
        {logoBusy ? <Loading size="sm" /> : null}
      </FormSection>

      <FormSection title={t('onboarding:basics.typeTitle')} description={t('onboarding:basics.typeHelp')}>
        <div role="radiogroup" aria-label={t('onboarding:basics.typeTitle')} className="grid gap-3 sm:grid-cols-2">
          {BUSINESS_TYPES.map((type) => {
            const selected = businessType === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onBusinessTypeChange(type)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  selected ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200',
                )}
              >
                <span aria-hidden className={cn('mt-0.5 text-xl', selected ? 'text-primary' : 'text-base-content/60')}>
                  {BUSINESS_TYPE_ICONS[type]}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{t(`onboarding:basics.types.${type}.title`)}</span>
                  <span className="text-sm text-base-content/60">{t(`onboarding:basics.types.${type}.help`)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {suggestion ? (
          <Alert variant="info">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>{t('onboarding:basics.dayStartSuggestion', { time: suggestion })}</span>
              <Button type="button" size="sm" variant="outline" disabled={dayStartSaving} onClick={() => void applyDayStart(suggestion)}>
                {dayStartSaving ? <Loading size="sm" /> : null}
                {t('onboarding:basics.dayStartApply', { time: suggestion })}
              </Button>
            </div>
          </Alert>
        ) : null}
        {businessType === 'private' ? <p className="text-sm text-base-content/70">{t('onboarding:basics.privateHint')}</p> : null}
      </FormSection>
    </div>
  );
}
