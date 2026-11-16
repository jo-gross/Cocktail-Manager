/**
 * Anchors for tour steps. Every id is a `data-tour` attribute on an element, set via {@link tourTarget}:
 *
 *   <Button {...tourTarget('bar.search')}>…</Button>
 *
 * `pnpm tours:check` (scripts/check-tour-targets.mjs) verifies that every target used in a tour definition is set
 * somewhere in `components/` or `pages/`.
 */
export const TOUR_TARGETS = [
  'bar.cardSelection',
  'bar.search',
  'bar.cocktailCard',
  'bar.addToQueue',
  'bar.queue',
  'bar.viewOptions',
  'bar.manageLink',
  'manage.cocktails',
  'manage.ingredients',
  'manage.cards',
  'manage.help',
  'manage.ingredients.create',
  'manage.ingredientForm',
  'manage.cocktails.create',
  'manage.cocktailForm',
  'manage.cards.create',
] as const;

export type TourTargetId = (typeof TOUR_TARGETS)[number];

export const TOUR_TARGET_ATTRIBUTE = 'data-tour';

/** Spread onto an element to make it a tour anchor. */
export function tourTarget(id: TourTargetId): { 'data-tour': TourTargetId } {
  return { [TOUR_TARGET_ATTRIBUTE]: id } as { 'data-tour': TourTargetId };
}

export function tourTargetSelector(id: TourTargetId): string {
  return `[${TOUR_TARGET_ATTRIBUTE}="${id}"]`;
}
