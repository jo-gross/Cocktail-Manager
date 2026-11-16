import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Router, { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { getBackStack } from '@lib/navigation/backStack';
import { fetchGuideProgress, updateGuideProgress } from '@lib/network/guides';
import { createRun, reduceTourRun, type TourRun, type TourRunAction } from '@lib/tours/engine';
import { MOBILE_BREAKPOINT } from '@lib/tours/placement';
import { getTour, getTourStatus, tourGuideId, TOURS, type GuideProgress, type GuideStatus } from '@lib/tours/registry';
import { loadLocalProgress, loadStoredRun, mergeProgress, storeLocalProgress, storeRun } from '@lib/tours/storage';
import type { TourDefinition } from '@lib/tours/types';
import { TourContext, type TourAction, type TourContextValue } from './TourContext';
import { TourOverlay } from './TourOverlay';

/**
 * Runs guided tours (lib/tours) and keeps the user's guide progress (API `/api/v1/me/guides`, localStorage fallback).
 * Needs UserContext, ModalContext and the Next router; mounted once in `_app.tsx`.
 *
 * Deep link: `?tour=<id>` starts a tour. A running tour survives reloads (sessionStorage). Esc and browser/Android
 * back end the tour before they close modals or leave the page.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('tours');
  const router = useRouter();
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const userId = userContext.user?.id;
  const queryWorkspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  const [progress, setProgress] = useState<Record<string, GuideProgress>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressSynced, setProgressSynced] = useState(false);
  const progressRef = useRef(progress);
  const [run, setRunState] = useState<TourRun | null>(null);
  const runRef = useRef<TourRun | null>(null);
  const actions = useRef(new Map<string, TourAction>());

  const setRun = useCallback((next: TourRun | null) => {
    runRef.current = next;
    storeRun(next);
    setRunState(next);
  }, []);

  // Progress: local copy first (instant, offline), then the server state.
  useEffect(() => {
    if (!userId) {
      progressRef.current = {};
      setProgress({});
      setProgressLoaded(false);
      setProgressSynced(false);
      return;
    }
    let cancelled = false;
    const local = loadLocalProgress(userId);
    progressRef.current = local;
    setProgress(local);
    setProgressSynced(false);
    fetchGuideProgress()
      .then((server) => {
        if (cancelled) return;
        const { merged, unsynced } = mergeProgress(server, local);
        progressRef.current = merged;
        setProgress(merged);
        setProgressSynced(true);
        storeLocalProgress(userId, merged);
        for (const entry of unsynced) {
          updateGuideProgress(entry.guideId, { status: entry.status, version: entry.version }).catch((error) =>
            console.debug('TourProvider -> sync local progress', entry.guideId, error),
          );
        }
      })
      .catch((error) => {
        // Older server without the progress API (404) or offline: the local copy is all we have.
        console.debug('TourProvider -> fetchGuideProgress', error);
      })
      .finally(() => {
        if (!cancelled) setProgressLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setGuideStatus = useCallback(
    (guideId: string, status: GuideStatus, version = 1) => {
      if (!userId) return;
      const entry: GuideProgress = { guideId, status, version, updatedAt: new Date().toISOString() };
      const next = { ...progressRef.current, [guideId]: entry };
      progressRef.current = next;
      setProgress(next);
      storeLocalProgress(userId, next);
      updateGuideProgress(guideId, { status, version }).catch((error) => console.debug('TourProvider -> updateGuideProgress', guideId, error));
    },
    [userId],
  );

  /** Started/dismissed never overwrite a completed tour (restarting it must not lose "abgeschlossen"). */
  const recordTourStatus = useCallback(
    (tour: TourDefinition, status: GuideStatus) => {
      const current = getTourStatus(tour, progressRef.current);
      if (current === status || (current === 'COMPLETED' && status !== 'COMPLETED')) return;
      setGuideStatus(tourGuideId(tour.id), status, tour.version);
    },
    [setGuideStatus],
  );

  // Continue a tour after a reload.
  const restored = useRef(false);
  useEffect(() => {
    if (!userId || restored.current) return;
    restored.current = true;
    const stored = loadStoredRun();
    if (stored && getTour(stored.tourId)) setRun(stored);
    else if (stored) storeRun(null);
  }, [userId, setRun]);

  const dispatch = useCallback(
    (action: TourRunAction) => {
      const current = runRef.current;
      if (!current) return;
      const result = reduceTourRun(current, action);
      const tour = getTour(current.tourId);
      // Ending early keeps the tour "STARTED" (= begonnen); DISMISSED is reserved for declined offers.
      if (tour && result.finished === 'COMPLETED') recordTourStatus(tour, 'COMPLETED');
      setRun(result.run);
    },
    [recordTourStatus, setRun],
  );

  const onNext = useCallback(() => dispatch({ type: 'next' }), [dispatch]);
  const onBack = useCallback(() => dispatch({ type: 'back' }), [dispatch]);
  const onSkip = useCallback(() => dispatch({ type: 'skip' }), [dispatch]);
  const endTour = useCallback(() => dispatch({ type: 'end' }), [dispatch]);

  const isUserPermitted = userContext.isUserPermitted;
  const startTour = useCallback(
    (tourId: string, options?: { workspaceId?: string }) => {
      const tour = getTour(tourId);
      const workspaceId = options?.workspaceId ?? queryWorkspaceId ?? userContext.workspace?.id ?? null;
      if (!tour || !isUserPermitted(tour.minRole)) {
        alertService.warn(t('engine.notAvailable'));
        return;
      }
      const next = createRun(tour, { isMobile: window.innerWidth < MOBILE_BREAKPOINT, workspaceId });
      if (!next) return;
      modalContext.closeAllModals();
      recordTourStatus(tour, 'STARTED');
      setRun(next);
    },
    [isUserPermitted, modalContext, queryWorkspaceId, recordTourStatus, setRun, t, userContext.workspace?.id],
  );

  // Deep link `?tour=<id>` – waits until the workspace (role) is loaded, then removes the parameter.
  useEffect(() => {
    const tourId = router.query.tour;
    if (!router.isReady || typeof tourId !== 'string' || !userId) return;
    if (queryWorkspaceId && userContext.workspace?.id !== queryWorkspaceId) return;
    const { tour: _tour, ...query } = router.query;
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    startTour(tourId);
  }, [router, router.isReady, router.query, queryWorkspaceId, startTour, userContext.workspace?.id, userId]);

  // Browser/Android back ends the tour (one history entry while it runs). Real page changes reset the back stack
  // (all overlays are closed) – those must not end a tour that spans several pages.
  const navigating = useRef(false);
  useEffect(() => {
    const onStart = () => (navigating.current = true);
    const onDone = () => (navigating.current = false);
    Router.events.on('routeChangeStart', onStart);
    Router.events.on('routeChangeComplete', onDone);
    Router.events.on('routeChangeError', onDone);
    return () => {
      Router.events.off('routeChangeStart', onStart);
      Router.events.off('routeChangeComplete', onDone);
      Router.events.off('routeChangeError', onDone);
    };
  }, []);
  const pagePath = router.asPath.split(/[?#]/)[0];
  const running = run !== null;
  useEffect(() => {
    if (!running) return;
    const stack = getBackStack();
    if (!stack) return;
    const id = stack.open(() => {
      if (!navigating.current) endTour();
    });
    return () => stack.close(id);
  }, [running, pagePath, endTour]);

  const registerAction = useCallback((id: string, action: TourAction) => {
    actions.current.set(id, action);
    return () => {
      if (actions.current.get(id) === action) actions.current.delete(id);
    };
  }, []);

  const runPrepare = useCallback(async (id: string) => {
    await actions.current.get(id)?.();
  }, []);

  const tours = useMemo(() => TOURS.filter((tour) => isUserPermitted(tour.minRole)), [isUserPermitted]);

  const value = useMemo<TourContextValue>(
    () => ({
      activeTourId: run?.tourId ?? null,
      tours,
      progress,
      progressLoaded,
      progressSynced,
      startTour,
      endTour,
      getTourStatus: (tourId) => {
        const tour = getTour(tourId);
        return tour ? getTourStatus(tour, progress) : 'NEW';
      },
      setGuideStatus,
      registerAction,
    }),
    [run?.tourId, tours, progress, progressLoaded, progressSynced, startTour, endTour, setGuideStatus, registerAction],
  );

  const activeTour = run ? getTour(run.tourId) : undefined;

  return (
    <TourContext.Provider value={value}>
      {children}
      {run && activeTour && <TourOverlay tour={activeTour} run={run} onNext={onNext} onBack={onBack} onSkip={onSkip} onEnd={endTour} runPrepare={runPrepare} />}
    </TourContext.Provider>
  );
}
