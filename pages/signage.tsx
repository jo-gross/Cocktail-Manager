import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '@lib/alertService';
import { $Enums } from '@generated/prisma/client';
import { PageCenter } from '@components/layout/PageCenter';
import { Loading } from '@components/Loading';
import { SignageSlideDisplay } from '@components/signage/SignageSlideDisplay';
import { SignageFormatView } from '@lib/signage/types';
import { filterSlidesForDisplay } from '@lib/signage/isSlideActiveNow';
import { getSignageContainerClassName, getSignageContainerStyle } from '@lib/signage/signageBackground';
import { cn } from '@components/ui';
import MonitorFormat = $Enums.MonitorFormat;

function getMonitorFormat(): MonitorFormat {
  if (typeof window === 'undefined') {
    return MonitorFormat.LANDSCAPE;
  }

  return window.matchMedia('(orientation: portrait)').matches ? MonitorFormat.PORTRAIT : MonitorFormat.LANDSCAPE;
}

function subscribeToOrientation(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(orientation: portrait)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

export default function SignagePage() {
  const router = useRouter();
  const { t } = useTranslation(['errors', 'manage', 'common', 'plan']);
  const { id, key } = router.query;
  // Monitor key: required for PIN-protected guest menu slides (skipped without it).
  const signageKey = typeof key === 'string' ? key : '';

  const format = useSyncExternalStore(subscribeToOrientation, getMonitorFormat, () => MonitorFormat.LANDSCAPE);
  const [content, setContent] = useState<SignageFormatView>();
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  // Hosted instances: the plan of the workspace does not include signage (feed answers 402).
  const [planRequired, setPlanRequired] = useState<boolean>(false);
  // Hosted instances: the workspace is suspended (feed answers 503).
  const [unavailable, setUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(
    (options?: { silent?: boolean }) => {
      if (!id) return;
      if (!options?.silent) {
        setImageLoading(true);
      }
      const keyQuery = signageKey ? `&key=${encodeURIComponent(signageKey)}` : '';
      fetch(`/api/signage/${id}?format=${format}${keyQuery}`)
        .then((response) => response.json().then((data) => ({ status: response.status, data })))
        .then(({ status, data }) => {
          // Only the feed's own answers switch the view; any other failure (e.g. a 503 page of a reverse proxy during
          // a restart) keeps the slides, as before.
          const code = data?.error?.code;
          const isUnavailable = status === 503 && code === 'WORKSPACE_UNAVAILABLE';
          const isPlanRequired = status === 402 && code === 'PLAN_FEATURE_MISSING';
          setUnavailable(isUnavailable);
          setPlanRequired(isPlanRequired);
          if (isUnavailable || isPlanRequired) return;
          setContent(data.content);
        })
        .catch((error) => {
          console.error('Signage', error);
          if (!options?.silent) {
            alertService.error(t('errors:loadCard'));
          }
        })
        .finally(() => {
          if (!options?.silent) {
            setImageLoading(false);
          }
        });
    },
    [id, format, signageKey, t],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!id) return;

    const interval = window.setInterval(
      () => {
        fetchData({ silent: true });
      },
      5 * 60 * 1000,
    );

    return () => window.clearInterval(interval);
  }, [id, fetchData]);

  const slides = useMemo(() => filterSlidesForDisplay(content?.slides ?? []), [content?.slides]);
  const backgroundMode = content?.backgroundMode ?? 'COLOR';

  return (
    <div
      className={cn('relative h-screen w-screen', getSignageContainerClassName(backgroundMode, content?.backgroundColor, { external: true }))}
      style={getSignageContainerStyle(backgroundMode, content?.backgroundColor)}
    >
      {imageLoading ? (
        <PageCenter>
          <Loading />
        </PageCenter>
      ) : unavailable ? (
        <PageCenter>
          <p className="text-center text-xl">{t('plan:signage.unavailable')}</p>
        </PageCenter>
      ) : planRequired ? (
        <PageCenter>
          <p className="text-center text-xl">{t('plan:signage.planRequired')}</p>
        </PageCenter>
      ) : (
        <SignageSlideDisplay
          slides={slides}
          slideDurationSeconds={content?.slideDurationSeconds ?? 10}
          backgroundMode={backgroundMode}
          emptyMessage={t('manage:noCardsFound')}
          alt={t('common:monitorSlideAlt')}
          workspaceId={typeof id === 'string' ? id : undefined}
          format={format}
        />
      )}
    </div>
  );
}
