import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { Button, Loading, Skeleton } from '@components/ui';
import { SetupStepper } from '@components/onboarding/SetupStepper';
import { LanguageStep } from '@components/onboarding/steps/LanguageStep';
import { BasicsStep } from '@components/onboarding/steps/BasicsStep';
import { ContentStep } from '@components/onboarding/steps/ContentStep';
import { TeamStep } from '@components/onboarding/steps/TeamStep';
import { DoneStep } from '@components/onboarding/steps/DoneStep';
import type { StepSave } from '@components/onboarding/steps/types';
import type { AppliedTemplate } from '@components/onboarding/StartContentPanel';
import { UserContext } from '@lib/context/UserContextProvider';
import {
  businessTypePreselection,
  isBusinessType,
  isSetupStep,
  nextSetupStep,
  previousSetupStep,
  setupSteps,
  type BusinessType,
  type SetupStep,
} from '@lib/onboarding/setupWizard';

/** The business type is not saved in the workspace; it only survives reloads of the wizard. */
function businessTypeKey(workspaceId: string) {
  return `setup:businessType:${workspaceId}`;
}

function readBusinessType(workspaceId: string | undefined): BusinessType | null {
  if (!workspaceId) return null;
  try {
    const value = sessionStorage.getItem(businessTypeKey(workspaceId));
    return isBusinessType(value) ? value : null;
  } catch {
    return null;
  }
}

function SetupPage() {
  const { t } = useTranslation(['onboarding', 'common']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;
  const workspace = userContext.workspace?.id === workspaceId ? userContext.workspace : undefined;

  const steps = setupSteps({ isExternallyManaged: workspace?.isExternallyManaged ?? false });
  const queryStep = router.query.step;
  const step: SetupStep = isSetupStep(queryStep) && steps.includes(queryStep) ? queryStep : 'language';

  const saveRef = useRef<StepSave | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [navigating, setNavigating] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [contentLocaleDraft, setContentLocaleDraft] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedTemplate[]>([]);
  const [teamLink, setTeamLink] = useState<string | null>(null);
  const { skipTeam } = businessTypePreselection(businessType);
  const contentLocale = contentLocaleDraft ?? userContext.contentLocales?.primary ?? userContext.uiLocale;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only available after mount
    setBusinessType(readBusinessType(workspaceId));
  }, [workspaceId]);

  const chooseBusinessType = useCallback(
    (type: BusinessType) => {
      setBusinessType(type);
      if (!workspaceId) return;
      try {
        sessionStorage.setItem(businessTypeKey(workspaceId), type);
      } catch {
        // ignore
      }
    },
    [workspaceId],
  );

  const goTo = useCallback(
    async (target: SetupStep, options: { save: boolean }) => {
      if (navigating) return;
      setNavigating(true);
      try {
        if (options.save && saveRef.current && !(await saveRef.current())) return;
        saveRef.current = null;
        await router.replace({ pathname: router.pathname, query: { ...router.query, step: target } }, undefined, { shallow: true });
        window.scrollTo({ top: 0 });
        // Move the focus to the new step's title (screen readers announce the step change).
        headingRef.current?.focus({ preventScroll: true });
      } finally {
        setNavigating(false);
      }
    },
    [navigating, router],
  );

  const next = () => void goTo(nextSetupStep(steps, step, { skipTeam }), { save: true });
  const skip = () => void goTo(nextSetupStep(steps, step, { skipTeam }), { save: false });
  const back = () => void goTo(previousSetupStep(steps, step, { skipTeam }), { save: false });
  const isFirst = steps.indexOf(step) === 0;

  return (
    <ManageEntityLayout
      backLink={workspaceId ? `/workspaces/${workspaceId}` : '/'}
      alwaysUseBackLink
      title={t('onboarding:title')}
      subtitle={workspace?.name}
      actions={
        workspaceId && step !== 'done' ? (
          // On narrow screens the back arrow already leaves the wizard; the text button would collide with the title.
          <Link href={`/workspaces/${workspaceId}`} className="hidden sm:block">
            <Button type="button" variant="ghost">
              {t('onboarding:continueLater')}
            </Button>
          </Link>
        ) : null
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 md:gap-8">
        <SetupStepper
          steps={steps}
          current={step}
          skipped={skipTeam ? ['team'] : []}
          disabled={navigating}
          onSelect={(target) => void goTo(target, { save: true })}
        />

        <div className="flex flex-col gap-4 md:gap-6">
          {/* The done step brings its own hero header. */}
          {step !== 'done' ? (
            <header className="flex flex-col gap-1">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
                {t(`onboarding:steps.${step}.title`)}
              </h1>
              <p className="text-sm text-base-content/70">{t(`onboarding:steps.${step}.description`)}</p>
            </header>
          ) : null}

          {!workspaceId || !workspace ? (
            <div className="flex flex-col gap-4 md:gap-6" aria-busy="true">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : step === 'language' ? (
            <LanguageStep workspaceId={workspaceId} saveRef={saveRef} onContentLocaleChange={setContentLocaleDraft} />
          ) : step === 'basics' ? (
            <BasicsStep workspaceId={workspaceId} saveRef={saveRef} businessType={businessType} onBusinessTypeChange={chooseBusinessType} />
          ) : step === 'content' ? (
            <ContentStep
              workspaceId={workspaceId}
              saveRef={saveRef}
              locale={contentLocale}
              applied={applied}
              onApplied={(entry) => setApplied((previous) => [...previous, entry])}
              onStartEmpty={skip}
            />
          ) : step === 'team' ? (
            <TeamStep workspaceId={workspaceId} saveRef={saveRef} onLinkChange={setTeamLink} />
          ) : (
            <DoneStep workspaceId={workspaceId} saveRef={saveRef} contentLocale={contentLocale} applied={applied} teamLink={teamLink} />
          )}
        </div>
      </div>

      {step !== 'done' ? (
        // Full-bleed action bar; the primary action always sits at the right edge of the content column.
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 -mb-4 border-t border-base-300 bg-base-100/95 backdrop-blur md:-mx-5 md:-mb-5">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-0">
            <Button type="button" variant="ghost" disabled={navigating} onClick={back} className={isFirst ? 'invisible' : undefined}>
              <FaArrowLeft aria-hidden />
              {t('common:back')}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={navigating} onClick={skip}>
                {t('common:skip')}
              </Button>
              <Button type="button" variant="primary" disabled={navigating} onClick={next}>
                {navigating ? <Loading size="sm" /> : null}
                {t('common:next')}
                {navigating ? null : <FaArrowRight aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ManageEntityLayout>
  );
}

export default withPagePermission(['ADMIN'], SetupPage, '/workspaces/[workspaceId]');
