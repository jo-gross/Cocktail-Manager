import React, { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { settingsHref } from '@components/settings/settingsNavigation';
import { StartContentPanel, type AppliedTemplate } from '../StartContentPanel';
import type { SetupStepProps } from './types';

interface ContentStepProps extends SetupStepProps {
  locale: string;
  applied: AppliedTemplate[];
  onApplied: (applied: AppliedTemplate) => void;
  onStartEmpty: () => void;
}

/** Step 3: start content collections or an empty start. Templates are applied right away, so "Next" has nothing to save. */
export function ContentStep({ workspaceId, saveRef, locale, applied, onApplied, onStartEmpty }: ContentStepProps) {
  const { t } = useTranslation(['onboarding']);

  useEffect(() => {
    saveRef.current = async () => true;
  }, [saveRef]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title={t('onboarding:content.collectionsTitle')} description={t('onboarding:content.modalHelp')}>
        <StartContentPanel workspaceId={workspaceId} locale={locale} applied={applied} onApplied={onApplied} />
      </FormSection>

      <FormSection title={t('onboarding:content.emptyTitle')} description={t('onboarding:content.emptyHelp')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="button" variant="outline" onClick={onStartEmpty}>
            {t('onboarding:content.startEmpty')}
          </Button>
          <Link href={settingsHref(workspaceId, 'data')} className="link text-sm">
            {t('onboarding:content.importBackup')}
          </Link>
        </div>
      </FormSection>
    </div>
  );
}
