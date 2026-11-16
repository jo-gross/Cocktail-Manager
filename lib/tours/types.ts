import type { ParseKeys } from 'i18next';
import type { Role } from '@generated/prisma/client';
import type { TourTargetId } from './targets';
import type { TourEventName } from './events';

/** i18n key in the `tours` namespace. */
export type TourTextKey = ParseKeys<'tours'>;

export type TourCategory = 'basics' | 'feature';

export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/**
 * - `click`: the user clicks the target
 * - `{ route }`: the user navigates to the route (same `[workspaceId]` placeholder as {@link TourStep.route})
 * - `{ event }`: a component emits the event via `tourEvents.emit`
 */
export type TourAdvanceOn = 'click' | { route: string } | { event: TourEventName };

interface TourStepBase {
  /** Unique within the tour. */
  id: string;
  title: TourTextKey;
  body: TourTextKey;
  /**
   * Page of the step, e.g. `/workspaces/[workspaceId]/manage`. Steps without a route inherit the route of the
   * previous step. The engine navigates there before showing the step.
   */
  route?: string;
  /** Id registered with `useTourAction` – runs (and is awaited) before the target is looked up. */
  prepare?: string;
  /** Leave the step out on small screens (< md). */
  hideOn?: 'mobile';
  /**
   * The step can be skipped by the user (action steps show "Überspringen"). Steps whose target never appears are
   * always skipped; for non-optional steps this is logged as a warning.
   */
  optional?: boolean;
}

/** Text only, centered card (target optional: highlighted when present). */
export interface TourInfoStep extends TourStepBase {
  kind: 'info';
  target?: TourTargetId;
}

/** Spotlight on the target, "Weiter" advances; the target itself is not clickable. */
export interface TourHighlightStep extends TourStepBase {
  kind: 'highlight';
  target: TourTargetId;
  placement?: TourPlacement;
}

/** Spotlight on the target, the user performs the action to advance. */
export interface TourActionStep extends TourStepBase {
  kind: 'action';
  target: TourTargetId;
  placement?: TourPlacement;
  advanceOn: TourAdvanceOn;
}

export type TourStep = TourInfoStep | TourHighlightStep | TourActionStep;

export interface TourDefinition {
  /** Kebab case, stored as guide id `tour:<id>`. */
  id: string;
  /** Bump when the tour changed substantially – users with an older completed version see it as new again. */
  version: number;
  category: TourCategory;
  /** Minimum workspace role. */
  minRole: Role;
  title: TourTextKey;
  description: TourTextKey;
  /**
   * Tour for a new feature: announced in the changelog modal for users whose last seen version is older than
   * `since`, and shown with a "Neu" badge (on the manage link with the `highlight` target, if set) until opened or
   * dismissed.
   */
  announce?: { since: string; highlight?: TourTargetId };
  steps: TourStep[];
}
