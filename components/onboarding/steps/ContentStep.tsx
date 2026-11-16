import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody } from '@components/ui';
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody compact className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('onboarding:content.emptyTitle')}</span>
            <span className="text-sm text-base-content/70">{t('onboarding:content.emptyHelp')}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onStartEmpty}>
            {t('onboarding:content.startEmpty')}
          </Button>
        </CardBody>
      </Card>
      <StartContentPanel workspaceId={workspaceId} locale={locale} applied={applied} onApplied={onApplied} showBackupLink />
    </div>
  );
}
