import { useMemo } from 'react';
import { getUnseenFeatureTours } from '@lib/tours/registry';
import type { TourTargetId } from '@lib/tours/targets';
import { useTour } from './TourContext';

/** Announced feature tours the user has not opened or dismissed yet ("Neu" badges on the manage page). */
export function useNewFeatureTours() {
  const { tours, progress, progressLoaded } = useTour();
  return useMemo(() => {
    // Without loaded progress every tour would look new for a moment.
    const unseen = progressLoaded ? getUnseenFeatureTours(tours, progress) : [];
    const highlighted = new Set<TourTargetId>(unseen.flatMap((tour) => (tour.announce?.highlight ? [tour.announce.highlight] : [])));
    return { unseen, isNew: (target: TourTargetId) => highlighted.has(target) };
  }, [tours, progress, progressLoaded]);
}
