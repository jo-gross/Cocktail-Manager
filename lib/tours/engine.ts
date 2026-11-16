/**
 * Pure step navigation of a running tour (no DOM, no React) – the TourProvider feeds it actions and persists the
 * resulting {@link TourRun} in sessionStorage so a reload continues at the same step.
 */
import type { GuideStatus } from './registry';
import type { TourDefinition, TourStep } from './types';

export interface TourRun {
  tourId: string;
  /** Steps of this run (steps with `hideOn: 'mobile'` are left out on small screens). */
  stepIds: string[];
  stepIndex: number;
  /** Indices of steps that were shown, for "Zurück" (skipped steps are not part of it). */
  visited: number[];
  /** Direction of the last move – a missing target skips further in this direction. */
  direction: 1 | -1;
  /** Workspace the tour runs in, fills the `[workspaceId]` placeholder of routes. */
  workspaceId: string | null;
}

export type TourRunAction =
  | { type: 'next' }
  | { type: 'back' }
  /** The target of the current step did not appear. */
  | { type: 'skip' }
  | { type: 'end' };

export interface TourRunResult {
  run: TourRun | null;
  /** Set when the action finished the tour. */
  finished?: Extract<GuideStatus, 'COMPLETED' | 'DISMISSED'>;
}

export function createRun(tour: TourDefinition, options: { isMobile: boolean; workspaceId: string | null; stepIndex?: number }): TourRun | null {
  const stepIds = tour.steps.filter((step) => !(options.isMobile && step.hideOn === 'mobile')).map((step) => step.id);
  if (stepIds.length === 0) return null;
  const stepIndex = Math.min(Math.max(options.stepIndex ?? 0, 0), stepIds.length - 1);
  return { tourId: tour.id, stepIds, stepIndex, visited: [], direction: 1, workspaceId: options.workspaceId };
}

export function reduceTourRun(run: TourRun, action: TourRunAction): TourRunResult {
  const last = run.stepIds.length - 1;
  switch (action.type) {
    case 'next':
      if (run.stepIndex >= last) return { run: null, finished: 'COMPLETED' };
      return { run: { ...run, stepIndex: run.stepIndex + 1, visited: [...run.visited, run.stepIndex], direction: 1 } };
    case 'back': {
      if (run.visited.length === 0) return { run };
      const visited = run.visited.slice(0, -1);
      return { run: { ...run, stepIndex: run.visited[run.visited.length - 1], visited, direction: -1 } };
    }
    case 'skip':
      if (run.direction === -1 && run.visited.length > 0) {
        const visited = run.visited.slice(0, -1);
        return { run: { ...run, stepIndex: run.visited[run.visited.length - 1], visited } };
      }
      // Nothing visible left: a tour whose remaining steps are all unavailable is done.
      if (run.stepIndex >= last) return { run: null, finished: run.visited.length > 0 ? 'COMPLETED' : 'DISMISSED' };
      return { run: { ...run, stepIndex: run.stepIndex + 1, direction: 1 } };
    case 'end':
      return { run: null, finished: 'DISMISSED' };
  }
}

export function getRunStep(tour: TourDefinition, run: TourRun): TourStep | undefined {
  const id = run.stepIds[run.stepIndex];
  return tour.steps.find((step) => step.id === id);
}

/** Route of the step, inherited from the closest previous step of the tour that defines one. */
export function getStepRoute(tour: TourDefinition, stepId: string): string | undefined {
  const index = tour.steps.findIndex((step) => step.id === stepId);
  for (let i = index; i >= 0; i--) {
    if (tour.steps[i].route) return tour.steps[i].route;
  }
  return undefined;
}

/** Fills the `[workspaceId]` placeholder; `null` when the route needs a workspace that is unknown. */
export function resolveRoute(route: string, workspaceId: string | null): string | null {
  if (!route.includes('[workspaceId]')) return route;
  if (!workspaceId) return null;
  return route.replaceAll('[workspaceId]', encodeURIComponent(workspaceId));
}

function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0];
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}

/** Whether the current `asPath` is the (resolved) route. */
export function isOnRoute(asPath: string, route: string, workspaceId: string | null): boolean {
  const resolved = resolveRoute(route, workspaceId);
  return resolved !== null && normalizePath(asPath) === normalizePath(resolved);
}
