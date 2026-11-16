import { TOUR_TARGETS } from './targets';
import { TOUR_EVENTS } from './events';
import type { TourDefinition } from './types';

const TOUR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const ROUTE_PATTERN = /^\/[^?#\s]*$/;

/** Structural problems of a tour definition (empty = valid). Types catch most mistakes; this covers the rest. */
export function validateTour(tour: TourDefinition): string[] {
  const errors: string[] = [];
  const prefix = `tour "${tour.id}"`;

  if (!TOUR_ID_PATTERN.test(tour.id)) errors.push(`${prefix}: id must be kebab case`);
  if (!Number.isInteger(tour.version) || tour.version < 1) errors.push(`${prefix}: version must be a positive integer`);
  if (tour.announce && !VERSION_PATTERN.test(tour.announce.since)) errors.push(`${prefix}: announce.since must be a x.y.z version`);
  if (tour.announce?.highlight && !(TOUR_TARGETS as readonly string[]).includes(tour.announce.highlight)) {
    errors.push(`${prefix}: unknown announce.highlight target "${tour.announce.highlight}"`);
  }
  if (tour.steps.length === 0) errors.push(`${prefix}: needs at least one step`);

  const stepIds = new Set<string>();
  tour.steps.forEach((step, index) => {
    const stepPrefix = `${prefix} step ${index} ("${step.id}")`;
    if (stepIds.has(step.id)) errors.push(`${stepPrefix}: duplicate step id`);
    stepIds.add(step.id);

    if (step.target !== undefined && !(TOUR_TARGETS as readonly string[]).includes(step.target)) {
      errors.push(`${stepPrefix}: unknown target "${step.target}"`);
    }
    if (step.kind !== 'info' && !(step as { target?: string }).target) errors.push(`${stepPrefix}: ${step.kind} steps need a target`);
    if (step.route !== undefined && !ROUTE_PATTERN.test(step.route)) errors.push(`${stepPrefix}: route must be a path without query`);

    if (step.kind === 'action') {
      const advanceOn = step.advanceOn;
      if (typeof advanceOn === 'object' && 'route' in advanceOn && !ROUTE_PATTERN.test(advanceOn.route)) {
        errors.push(`${stepPrefix}: advanceOn.route must be a path without query`);
      }
      if (typeof advanceOn === 'object' && 'event' in advanceOn && !(TOUR_EVENTS as readonly string[]).includes(advanceOn.event)) {
        errors.push(`${stepPrefix}: unknown event "${advanceOn.event}"`);
      }
    }
  });

  if (tour.steps.length > 0 && !tour.steps[0].route) errors.push(`${prefix}: the first step needs a route`);

  return errors;
}

/** Identity helper for typed tour definitions (`lib/tours/definitions/*`). */
export function defineTour<T extends TourDefinition>(tour: T): T {
  return tour;
}
