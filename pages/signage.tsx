import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
  const { id } = router.query;

  const format = useSyncExternalStore(subscribeToOrientation, getMonitorFormat, () => MonitorFormat.LANDSCAPE);
  const [content, setContent] = useState<SignageFormatView>();
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  const fetchData = useCallback(
    (options?: { silent?: boolean }) => {
      if (!id) return;
      if (!options?.silent) {
        setImageLoading(true);
      }
      fetch(`/api/signage/${id}?format=${format}`)
        .then((response) => response.json())
        .then((data) => {
          setContent(data.content);
        })
        .catch((error) => {
          console.error('Signage', error);
          if (!options?.silent) {
            alertService.error('Fehler beim Laden der Karte.');
          }
        })
        .finally(() => {
          if (!options?.silent) {
            setImageLoading(false);
          }
        });
    },
    [id, format],
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
      ) : (
        <SignageSlideDisplay
          slides={slides}
          slideDurationSeconds={content?.slideDurationSeconds ?? 10}
          backgroundMode={backgroundMode}
          emptyMessage="Keine Karte gefunden"
          alt="Monitor slide"
        />
      )}
    </div>
  );
}
