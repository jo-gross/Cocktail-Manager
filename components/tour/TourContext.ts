import { createContext, useContext, useEffect, useRef } from 'react';
import type { GuideProgress, GuideStatus, TourStatus } from '@lib/tours/registry';
import type { TourDefinition } from '@lib/tours/types';

export type TourAction = () => void | Promise<void>;

export interface TourContextValue {
  /** Id of the running tour, `null` if none. */
  activeTourId: string | null;
  /** Tours the user may run in the current workspace (role filter). */
  tours: readonly TourDefinition[];
  /** Guide progress by guide id (`tour:<id>`, `checklist:<workspaceId>`). */
  progress: Record<string, GuideProgress>;
  /** `true` once the progress was loaded (from the API or the local fallback). */
  progressLoaded: boolean;
  /** `true` once the server progress was loaded – offers that depend on "no progress yet" wait for it. */
  progressSynced: boolean;
  /** Starts a tour (closes open modals). `workspaceId` defaults to the current workspace. */
  startTour: (tourId: string, options?: { workspaceId?: string }) => void;
  endTour: () => void;
  getTourStatus: (tourId: string) => TourStatus;
  setGuideStatus: (guideId: string, status: GuideStatus, version?: number) => void;
  /** Use {@link useTourAction} instead. */
  registerAction: (id: string, action: TourAction) => () => void;
}

export const TourContext = createContext<TourContextValue>({
  activeTourId: null,
  tours: [],
  progress: {},
  progressLoaded: false,
  progressSynced: false,
  startTour: () => {},
  endTour: () => {},
  getTourStatus: () => 'NEW',
  setGuideStatus: () => {},
  registerAction: () => () => {},
});

/** Tour state and controls, e.g. `const { startTour } = useTour()` to offer a tour after the setup wizard. */
export function useTour() {
  return useContext(TourContext);
}

/**
 * Registers a preparation for tour steps with `prepare: id` (e.g. open a dropdown so its content can be highlighted).
 * The engine awaits it before looking up the step target.
 */
export function useTourAction(id: string, action: TourAction) {
  const { registerAction } = useContext(TourContext);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => registerAction(id, () => actionRef.current()), [id, registerAction]);
}
