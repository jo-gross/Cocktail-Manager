import { compareVersions } from '@lib/changelog/userChangelog';
import { basicsBarTour } from './definitions/basicsBar';
import { basicsManageTour } from './definitions/basicsManage';
import type { TourDefinition } from './types';

/** All tours, in the order they are listed on the help page. */
export const TOURS: readonly TourDefinition[] = [basicsBarTour, basicsManageTour];

export type GuideStatus = 'STARTED' | 'COMPLETED' | 'DISMISSED';

export interface GuideProgress {
  guideId: string;
  status: GuideStatus;
  version: number;
  updatedAt: string;
}

/** Status shown to the user: `NEW` = never opened (or only an older version of the tour). */
export type TourStatus = 'NEW' | GuideStatus;

export function getTour(id: string): TourDefinition | undefined {
  return TOURS.find((tour) => tour.id === id);
}

export function tourGuideId(tourId: string): string {
  return `tour:${tourId}`;
}

export function checklistGuideId(workspaceId: string): string {
  return `checklist:${workspaceId}`;
}

export function getTourStatus(tour: TourDefinition, progress: Record<string, GuideProgress | undefined>): TourStatus {
  const entry = progress[tourGuideId(tour.id)];
  if (!entry) return 'NEW';
  // A completed older version of a reworked tour counts as new again; started/dismissed stay as they are.
  if (entry.status === 'COMPLETED' && entry.version < tour.version) return 'NEW';
  return entry.status;
}

/** Feature tours released after `lastSeenVersion` and up to `currentVersion` (changelog modal), newest first. */
export function getAnnouncedTours(tours: readonly TourDefinition[], currentVersion: string, lastSeenVersion?: string | null): TourDefinition[] {
  return tours
    .filter((tour) => tour.announce !== undefined)
    .filter((tour) => compareVersions(tour.announce!.since, currentVersion) <= 0)
    .filter((tour) => !lastSeenVersion || compareVersions(tour.announce!.since, lastSeenVersion) > 0)
    .sort((a, b) => compareVersions(b.announce!.since, a.announce!.since));
}

/** Announced tours the user has neither opened nor dismissed – drive the "Neu" badges. */
export function getUnseenFeatureTours(tours: readonly TourDefinition[], progress: Record<string, GuideProgress | undefined>): TourDefinition[] {
  return tours.filter((tour) => tour.announce !== undefined && getTourStatus(tour, progress) === 'NEW');
}
