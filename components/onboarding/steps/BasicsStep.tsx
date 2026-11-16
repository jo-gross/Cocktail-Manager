import React, { useContext, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaGlassMartiniAlt, FaHome, FaMagic, FaUtensils } from 'react-icons/fa';
import { MdCelebration } from 'react-icons/md';
import { Loading, Skeleton, cn } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { isValidWorkspaceName, WorkspaceNameField } from '@components/settings/WorkspaceNameField';
import { WorkspaceLogoField } from '@components/settings/WorkspaceLogoField';
import { DayStartField } from '@components/settings/RegionFields';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspaceSettings, updateWorkspace, updateWorkspaceSetting } from '@lib/network/workspaces';
import {
  BUSINESS_TYPES,
  businessTypeEffects,
  DEFAULT_DAY_START,
  dayStartForBusinessType,
  isCustomDayStart,
  isValidDayStart,
  type BusinessType,
} from '@lib/onboarding/setupWizard';
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

interface DayStartState {
  /** Stored value (`null` = unset). */
  saved: string | null;
  /** Value in the field. */
  value: string;
  /** Set by the user (typed here or a custom stored value): the business type no longer preselects it. */
  edited: boolean;
}

/** Step 2: name, logo, business type (not saved) and the day start it preselects. */
export function BasicsStep({ workspaceId, saveRef, businessType, onBusinessTypeChange }: BasicsStepProps) {
  const { t } = useTranslation(['onboarding', 'settings', 'errors']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const [name, setName] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoKey, setLogoKey] = useState(0);
  const [dayStart, setDayStart] = useState<DayStartState | null>(null);
  const typeIdPrefix = useId();
  const currentName = workspace?.name ?? '';
  const value = name ?? currentName;
  // Derived, so the field follows every change of the business type until the user sets the time.
  const shownDayStart = dayStart ? (businessType ? dayStartForBusinessType(businessType, dayStart.value, dayStart.edited) : dayStart.value) : null;

  useEffect(() => {
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (cancelled) return;
        const saved = settings.statisticDayStartTime || null;
        setDayStart({ saved, value: saved ?? DEFAULT_DAY_START, edited: isCustomDayStart(saved) });
      })
      .catch((error) => alertApiV1Error(error, t('errors:loadSettings')));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  useEffect(() => {
    saveRef.current = async () => {
      if (!isValidWorkspaceName(value)) return false;
      if (!dayStart || shownDayStart === null || !isValidDayStart(shownDayStart)) return false;
      const trimmed = value.trim();
      try {
        if (trimmed !== currentName) {
          await updateWorkspace(workspaceId, { name: trimmed });
          await refreshWorkspace();
          setName(null);
        }
        if (shownDayStart !== dayStart.saved) {
          await updateWorkspaceSetting(workspaceId, { setting: 'statisticDayStartTime', value: shownDayStart });
          setDayStart({ ...dayStart, saved: shownDayStart, value: shownDayStart });
        }
        return true;
      } catch (error) {
        alertApiV1Error(error, t('errors:save'));
        return false;
      }
    };
  }, [saveRef, value, currentName, dayStart, shownDayStart, workspaceId, refreshWorkspace, t]);

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

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title={t('onboarding:basics.nameTitle')} description={t('settings:general.nameHelp')}>
        <WorkspaceNameField id="setup-workspace-name" value={value} onChange={setName} />
      </FormSection>

      <FormSection title={t('settings:logo.title')} description={t('settings:logo.help')}>
        <WorkspaceLogoField key={logoKey} image={workspace?.image} name={currentName} disabled={logoBusy} onChange={(image) => void saveLogo(image)} />
        {logoBusy ? <Loading size="sm" /> : null}
      </FormSection>

      <FormSection title={t('onboarding:basics.typeTitle')} description={t('onboarding:basics.typeHelp')}>
        <div role="radiogroup" aria-label={t('onboarding:basics.typeTitle')} className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          {BUSINESS_TYPES.map((type) => {
            const selected = businessType === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-labelledby={`${typeIdPrefix}-${type}-title`}
                aria-describedby={`${typeIdPrefix}-${type}-help ${typeIdPrefix}-${type}-effects`}
                onClick={() => onBusinessTypeChange(type)}
                className={cn(
                  'flex h-full min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-base-100 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  selected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-base-300 hover:border-base-400 hover:bg-base-200',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
                    selected ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/70',
                  )}
                >
                  {BUSINESS_TYPE_ICONS[type]}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span id={`${typeIdPrefix}-${type}-title`} className="font-medium">
                    {t(`onboarding:basics.types.${type}.title`)}
                  </span>
                  <span id={`${typeIdPrefix}-${type}-help`} className="text-sm text-base-content/60">
                    {t(`onboarding:basics.types.${type}.help`)}
                  </span>
                  {/* What the type changes, derived from the preselection rules (phrasing content only inside the button). */}
                  <span id={`${typeIdPrefix}-${type}-effects`} className="mt-2 flex flex-col gap-1 border-t border-base-300 pt-2 text-xs">
                    <span className="sr-only">{t('onboarding:basics.effects.label')}</span>
                    {businessTypeEffects(type).map((effect) => (
                      <span key={effect.kind} className="flex items-start gap-1.5 text-base-content/80">
                        <FaMagic aria-hidden className="mt-0.5 shrink-0 text-primary" />
                        {effect.kind === 'dayStart'
                          ? t('onboarding:basics.effects.dayStart', { time: effect.time })
                          : t(`onboarding:basics.effects.${effect.kind}`)}
                      </span>
                    ))}
                  </span>
                </span>
                <FaCheckCircle aria-hidden className={cn('mt-0.5 shrink-0 text-primary', !selected && 'invisible')} />
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 md:flex-row md:items-start md:gap-6">
          {shownDayStart !== null ? (
            <DayStartField
              id="setup-day-start"
              className="md:w-56 md:shrink-0"
              label={t('onboarding:basics.dayStartTitle')}
              value={shownDayStart}
              onChange={(time) => setDayStart((previous) => (previous ? { ...previous, value: time, edited: true } : previous))}
              hint={
                businessType && !dayStart?.edited
                  ? t('onboarding:basics.dayStartPreselected', { type: t(`onboarding:basics.types.${businessType}.title`) })
                  : undefined
              }
            />
          ) : (
            <Skeleton className="h-16 w-full md:w-56" />
          )}
          <p className="text-sm text-base-content/70 md:pt-6">{t('onboarding:basics.dayStartHelp')}</p>
        </div>
      </FormSection>
    </div>
  );
}
