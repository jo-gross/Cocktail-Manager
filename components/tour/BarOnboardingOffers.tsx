import React, { useContext, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { Role } from '@generated/prisma/client';
import { Button, Card, CardBody } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { checklistGuideId, tourGuideId } from '@lib/tours/registry';
import { shouldShowChecklistCard, summarizeChecklist } from '@lib/tours/checklist';
import { basicsBarTour } from '@lib/tours/definitions/basicsBar';
import { useTour } from './TourContext';
import { useOnboardingStatus } from './useOnboardingStatus';

const LATER_KEY = `tour:later:${basicsBarTour.id}`;

function readLater(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Non-blocking offers at the top of the bar view: the basics tour for users who never saw it, and the setup
 * checklist progress for managers (after the setup wizard, until done or hidden).
 */
export function BarOnboardingOffers() {
  const { t } = useTranslation('tours');
  const userContext = useContext(UserContext);
  const { activeTourId, progress, progressLoaded, progressSynced, startTour, setGuideStatus } = useTour();
  const [later, setLater] = useState(readLater);

  const workspace = userContext.workspace;
  const isManager = userContext.isUserPermitted(Role.MANAGER);
  const { status: onboarding } = useOnboardingStatus(workspace?.id, isManager);

  if (!workspace || !userContext.user || !progressLoaded || activeTourId) return null;

  // Only with confirmed server progress: existing users have a DISMISSED row from the migration, which an empty
  // local copy (offline, API error) must not hide.
  const showWelcome = progressSynced && !later && progress[tourGuideId(basicsBarTour.id)] === undefined;
  const checklistDismissed = progress[checklistGuideId(workspace.id)]?.status === 'DISMISSED';
  const showChecklist = !showWelcome && isManager && shouldShowChecklistCard(onboarding, checklistDismissed);

  if (showWelcome) {
    return (
      <div className="px-2 pt-2 print:hidden">
        <Card>
          <CardBody compact className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="font-bold">{t('offers.welcome.title', { workspace: workspace.name })}</h2>
              <p className="text-sm text-base-content/70">{t('offers.welcome.body')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => startTour(basicsBarTour.id)}>
                {t('offers.welcome.start')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    sessionStorage.setItem(LATER_KEY, '1');
                  } catch {
                    // ignore
                  }
                  setLater(true);
                }}
              >
                {t('offers.welcome.later')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setGuideStatus(tourGuideId(basicsBarTour.id), 'DISMISSED', basicsBarTour.version)}>
                {t('offers.welcome.never')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (showChecklist && onboarding) {
    const summary = summarizeChecklist(onboarding.checklist);
    return (
      <div className="px-2 pt-2 print:hidden">
        <Card>
          <CardBody compact className="flex flex-row items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="font-bold">{t('offers.checklist.title', { done: summary.done, total: summary.total })}</h2>
              <progress className="h-1.5 w-full max-w-xs overflow-hidden rounded-full accent-primary" value={summary.done} max={summary.total} />
              {summary.next && (
                <p className="text-sm text-base-content/70">{t('offers.checklist.next', { item: t(`help.checklist.items.${summary.next.id}`) })}</p>
              )}
            </div>
            <Link href={`/workspaces/${workspace.id}/manage/help`}>
              <Button variant="outline" size="sm">
                {t('offers.checklist.open')}
              </Button>
            </Link>
            <Button
              variant="ghost"
              shape="circle"
              size="sm"
              aria-label={t('offers.checklist.dismiss')}
              onClick={() => setGuideStatus(checklistGuideId(workspace.id), 'DISMISSED')}
            >
              <FaTimes aria-hidden="true" />
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return null;
}
