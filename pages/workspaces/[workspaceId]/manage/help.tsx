import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaChevronRight, FaRegCircle } from 'react-icons/fa';
import { Role } from '@generated/prisma/client';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { Badge, Button, Card, CardBody, Skeleton, type BadgeVariant } from '@components/ui';
import { useTour } from '@components/tour/TourContext';
import { StartContentModal } from '@components/onboarding/StartContentModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useOnboardingStatus } from '@components/tour/useOnboardingStatus';
import { UserContext } from '@lib/context/UserContextProvider';
import { checklistItemHref, summarizeChecklist } from '@lib/tours/checklist';
import { ONBOARDING_CHECKLIST_ITEMS } from '@lib/network/onboarding';
import type { TourStatus } from '@lib/tours/registry';
import type { UserChangelogEntry } from '@lib/changelog/userChangelog';

const STATUS_VARIANT: Record<TourStatus, BadgeVariant> = {
  NEW: 'primary',
  STARTED: 'warning',
  COMPLETED: 'success',
  DISMISSED: 'ghost',
};

/** How many releases "Was ist neu" shows (older ones are on GitHub). */
const CHANGELOG_ENTRIES = 5;

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="px-1 text-sm font-semibold text-base-content/60">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SetupChecklist({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('tours');
  const { status, loading, failed } = useOnboardingStatus(workspaceId);

  if (loading && !status) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (failed || !status) {
    return (
      <Card>
        <CardBody compact className="text-sm text-base-content/70">
          {t('help.checklist.unavailable')}
        </CardBody>
      </Card>
    );
  }

  const summary = summarizeChecklist(status.checklist);
  const items = status.checklist.filter((item) => (ONBOARDING_CHECKLIST_ITEMS as readonly string[]).includes(item.id));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 px-4 pt-4 md:px-5">
        <span className="text-sm font-medium">{t('help.checklist.progress', { done: summary.done, total: summary.total })}</span>
        <progress className="h-1.5 w-full overflow-hidden rounded-full accent-primary" value={summary.done} max={summary.total} />
      </div>
      <ul className="mt-2 divide-y divide-base-300">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={checklistItemHref(workspaceId, item.id)}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-200/60 focus-visible:bg-base-200/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none md:px-5"
            >
              {item.done ? (
                <FaCheckCircle aria-hidden="true" className="shrink-0 text-success" />
              ) : (
                <FaRegCircle aria-hidden="true" className="shrink-0 text-base-content/40" />
              )}
              <span className="sr-only">{item.done ? t('help.checklist.done') : t('help.checklist.open')}</span>
              <span className={item.done ? 'flex-1 text-base-content/60' : 'flex-1 font-medium'}>{t(`help.checklist.items.${item.id}`)}</span>
              {!item.done && item.open > 0 && <span className="text-sm text-base-content/60">{t('help.checklist.openCount', { count: item.open })}</span>}
              <FaChevronRight aria-hidden="true" className="shrink-0 text-xs text-base-content/30 group-hover:text-base-content/60" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SetupTools({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('onboarding');
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const locale = userContext.contentLocales?.primary ?? userContext.uiLocale;

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-base-300">
        <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium">{t('help.startContent.title')}</span>
            <span className="text-sm text-base-content/60">{t('help.startContent.description')}</span>
          </div>
          <Button variant="primary" size="sm" onClick={() => modalContext.openModal(<StartContentModal workspaceId={workspaceId} locale={locale} />)}>
            {t('help.startContent.action')}
          </Button>
        </li>
        <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium">{t('help.wizard.title')}</span>
            <span className="text-sm text-base-content/60">{t('help.wizard.description')}</span>
          </div>
          <Link href={`/workspaces/${workspaceId}/setup`}>
            <Button variant="outline" size="sm">
              {t('help.wizard.action')}
            </Button>
          </Link>
        </li>
      </ul>
    </Card>
  );
}

function TourList() {
  const { t } = useTranslation('tours');
  const { tours, getTourStatus, startTour } = useTour();

  if (tours.length === 0) {
    return (
      <Card>
        <CardBody compact className="text-sm text-base-content/70">
          {t('help.tours.empty')}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-base-300">
        {tours.map((tour) => {
          const status = getTourStatus(tour.id);
          return (
            <li key={tour.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t(tour.title)}</span>
                  <Badge variant={STATUS_VARIANT[status]} size="sm">
                    {t(`help.tours.status.${status}`)}
                  </Badge>
                  <Badge variant="ghost" size="sm" outline>
                    {t(`help.tours.category.${tour.category}`)}
                  </Badge>
                </div>
                <span className="text-sm text-base-content/60">{t(tour.description)}</span>
                <span className="text-xs text-base-content/50">{t('help.tours.steps', { count: tour.steps.length })}</span>
              </div>
              <Button variant={status === 'COMPLETED' || status === 'STARTED' ? 'outline' : 'primary'} size="sm" onClick={() => startTour(tour.id)}>
                {status === 'COMPLETED' || status === 'STARTED' ? t('help.tours.restart') : t('help.tours.start')}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function WhatsNew() {
  const { t } = useTranslation(['tours', 'common', 'auth']);
  const [entries, setEntries] = useState<UserChangelogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/user-changelog.json')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch changelog');
        return response.json() as Promise<UserChangelogEntry[]>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((error) => {
        console.error('HelpPage -> changelog', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Card>
        <CardBody compact className="text-sm text-base-content/70">
          {t('tours:help.changelog.error')}
        </CardBody>
      </Card>
    );
  }
  if (!entries) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <Card>
      <CardBody compact className="flex flex-col gap-4">
        {entries.length === 0 && <span className="text-sm text-base-content/70">{t('tours:help.changelog.empty')}</span>}
        {entries.slice(0, CHANGELOG_ENTRIES).map((entry) => (
          <div key={entry.version} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t('common:versionDate', { version: entry.version, date: entry.date })}</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {entry.highlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          </div>
        ))}
        <Link href="https://github.com/jo-gross/Cocktail-Manager/releases" className="link text-sm" target="_blank">
          {t('auth:viewAllChanges')}
        </Link>
      </CardBody>
    </Card>
  );
}

export default function HelpPage() {
  const router = useRouter();
  const { t } = useTranslation(['tours', 'onboarding']);
  const userContext = useContext(UserContext);
  const workspaceId = router.query.workspaceId as string | undefined;

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={t('tours:help.title')}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {workspaceId && userContext.isUserPermitted(Role.MANAGER) && (
          <HelpSection title={t('tours:help.checklist.title')}>
            <SetupChecklist workspaceId={workspaceId} />
          </HelpSection>
        )}
        {workspaceId && userContext.isUserPermitted(Role.ADMIN) && (
          <HelpSection title={t('onboarding:help.title')}>
            <SetupTools workspaceId={workspaceId} />
          </HelpSection>
        )}
        <HelpSection title={t('tours:help.tours.title')}>
          <TourList />
        </HelpSection>
        <HelpSection title={t('tours:help.changelog.title')}>
          <WhatsNew />
        </HelpSection>
      </div>
    </ManageEntityLayout>
  );
}
