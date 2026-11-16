import React, { useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { Button, Card, CardBody, Loading } from '@components/ui';
import { useTour } from '@components/tour/TourContext';
import { displayName } from '@components/settings/localeOptions';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertApiV1Error } from '@lib/network/apiV1';
import { completeOnboarding } from '@lib/network/onboarding';
import { basicsBarTour } from '@lib/tours/definitions/basicsBar';
import { TEMPLATE_ITEM_KINDS } from '@lib/onboarding/templateSelection';
import { sumCreated, useFormatCounts, type AppliedTemplate } from '../StartContentPanel';
import type { SetupStepProps } from './types';

interface DoneStepProps extends SetupStepProps {
  contentLocale: string;
  applied: AppliedTemplate[];
  teamLink: string | null;
}

/** Step 5: marks the setup as completed, sums up and offers the basics tour. */
export function DoneStep({ workspaceId, saveRef, contentLocale, applied, teamLink }: DoneStepProps) {
  const { t, i18n } = useTranslation(['onboarding', 'errors']);
  const router = useRouter();
  const { startTour } = useTour();
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const [completing, setCompleting] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const formatCounts = useFormatCounts();
  const completed = useRef(false);

  useEffect(() => {
    saveRef.current = async () => true;
  }, [saveRef]);

  useEffect(() => {
    if (completed.current) return;
    completed.current = true;
    completeOnboarding(workspaceId)
      .then(() => refreshWorkspace())
      .catch((error) => alertApiV1Error(error, t('errors:save')))
      .finally(() => setCompleting(false));
  }, [workspaceId, refreshWorkspace, t]);

  const created = sumCreated(applied);
  const hasContent = TEMPLATE_ITEM_KINDS.some((kind) => created[kind] > 0);

  const openBar = async (withTour: boolean) => {
    setLeaving(true);
    try {
      await router.push(`/workspaces/${workspaceId}`);
      if (withTour) startTour(basicsBarTour.id, { workspaceId });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col items-center gap-3 text-center">
          <FaCheckCircle aria-hidden className="text-5xl text-success" />
          <h2 className="text-2xl font-bold">{t('onboarding:done.title', { workspace: workspace?.name ?? '' })}</h2>
          <p className="max-w-prose text-base-content/70">{t('onboarding:done.body')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody compact className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('onboarding:done.summaryTitle')}</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-base-content/60">{t('onboarding:done.summary.language')}</dt>
            <dd>{displayName(contentLocale, 'language', i18n.language)}</dd>
            <dt className="text-base-content/60">{t('onboarding:done.summary.content')}</dt>
            <dd>
              {hasContent
                ? t('onboarding:done.summary.contentApplied', { templates: applied.map((entry) => entry.name).join(', '), items: formatCounts(created) })
                : t('onboarding:done.summary.contentEmpty')}
            </dd>
            <dt className="text-base-content/60">{t('onboarding:done.summary.team')}</dt>
            <dd>{teamLink ? t('onboarding:done.summary.teamLink') : t('onboarding:done.summary.teamNone')}</dd>
          </dl>
          {hasContent ? <p className="text-sm text-base-content/70">{t('onboarding:done.pricesHint')}</p> : null}
        </CardBody>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="primary" disabled={completing || leaving} onClick={() => void openBar(true)}>
            {completing || leaving ? <Loading size="sm" /> : null}
            {t('onboarding:done.startTour')}
          </Button>
          <Button type="button" variant="outline" disabled={completing || leaving} onClick={() => void openBar(false)}>
            {t('onboarding:done.later')}
          </Button>
        </div>
        <p className="text-center text-sm text-base-content/70">
          {t('onboarding:done.helpHint')}{' '}
          <Link href={`/workspaces/${workspaceId}/manage/help`} className="link">
            {t('onboarding:done.helpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
