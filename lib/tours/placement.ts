/** Pure geometry for the tour overlay: spotlight cutout and the position of the step card next to it. */
import type { TourPlacement } from './types';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Side = Exclude<TourPlacement, 'auto'>;

export interface CardPosition {
  top: number;
  left: number;
  /** Side of the target the card ended up on; `null` = no side fits, card overlaps the target area. */
  side: Side | null;
}

/** Below this width the card is a bottom sheet (Tailwind `md`). */
export const MOBILE_BREAKPOINT = 768;

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const AUTO_ORDER: Side[] = ['bottom', 'top', 'right', 'left'];

/** Target rect plus padding, clipped to the viewport (huge targets such as forms must not hide the whole page). */
export function spotlightRect(target: Rect, viewport: Size, padding = 6): Rect {
  const top = Math.max(target.top - padding, 0);
  const left = Math.max(target.left - padding, 0);
  const bottom = Math.min(target.top + target.height + padding, viewport.height);
  const right = Math.min(target.left + target.width + padding, viewport.width);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

function availableSpace(target: Rect, viewport: Size, side: Side): number {
  switch (side) {
    case 'top':
      return target.top;
    case 'bottom':
      return viewport.height - (target.top + target.height);
    case 'left':
      return target.left;
    case 'right':
      return viewport.width - (target.left + target.width);
  }
}

function fits(target: Rect, card: Size, viewport: Size, side: Side, gap: number, margin: number): boolean {
  const needed = (side === 'top' || side === 'bottom' ? card.height : card.width) + gap + margin;
  const crossFits = side === 'top' || side === 'bottom' ? card.width + 2 * margin <= viewport.width : card.height + 2 * margin <= viewport.height;
  return availableSpace(target, viewport, side) >= needed && crossFits;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Card position next to the target: the preferred side, then its opposite, then the remaining sides (`auto`: bottom,
 * top, right, left); if none fits,
 * the card is centered at the bottom of the viewport (it may overlap a target that fills the screen).
 */
export function computeCardPosition(target: Rect, card: Size, viewport: Size, placement: TourPlacement = 'auto', gap = 12, margin = 8): CardPosition {
  // `auto`: below/above reads most naturally, beside the target only for tall targets.
  const order: Side[] =
    placement === 'auto' ? AUTO_ORDER : [placement, OPPOSITE[placement], ...AUTO_ORDER.filter((side) => side !== placement && side !== OPPOSITE[placement])];

  const side = order.find((candidate) => fits(target, card, viewport, candidate, gap, margin));
  const maxLeft = viewport.width - card.width - margin;
  const maxTop = viewport.height - card.height - margin;
  const centerLeft = target.left + target.width / 2 - card.width / 2;
  const centerTop = target.top + target.height / 2 - card.height / 2;

  switch (side) {
    case 'top':
      return { side, top: target.top - gap - card.height, left: clamp(centerLeft, margin, maxLeft) };
    case 'bottom':
      return { side, top: target.top + target.height + gap, left: clamp(centerLeft, margin, maxLeft) };
    case 'left':
      return { side, top: clamp(centerTop, margin, maxTop), left: target.left - gap - card.width };
    case 'right':
      return { side, top: clamp(centerTop, margin, maxTop), left: target.left + target.width + gap };
    default:
      return {
        side: null,
        top: clamp(viewport.height - card.height - margin, margin, maxTop),
        left: clamp(viewport.width / 2 - card.width / 2, margin, maxLeft),
      };
  }
}

/** Bottom sheet on mobile: moves to the top edge when the target sits in the lower part the sheet would cover. */
export function sheetEdge(target: Rect | null, sheetHeight: number, viewport: Size): 'top' | 'bottom' {
  if (!target) return 'bottom';
  const sheetTop = viewport.height - sheetHeight;
  const targetBottom = target.top + target.height;
  if (targetBottom <= sheetTop) return 'bottom';
  // Target is covered by a bottom sheet – use the top edge if the target is visible there.
  return target.top >= sheetHeight ? 'top' : 'bottom';
}

/** Whether the rect lies (mostly) outside the viewport and must be scrolled into view. */
export function isOutOfView(target: Rect, viewport: Size): boolean {
  return (
    target.top < 0 || target.left < 0 || target.top + Math.min(target.height, viewport.height) > viewport.height || target.left + target.width > viewport.width
  );
}
