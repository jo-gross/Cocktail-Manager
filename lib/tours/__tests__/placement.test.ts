import { describe, expect, it } from 'vitest';
import { computeCardPosition, isOutOfView, sheetEdge, spotlightRect } from '../placement';

const viewport = { width: 1200, height: 800 };
const card = { width: 300, height: 200 };

describe('spotlightRect', () => {
  it('pads the target', () => {
    expect(spotlightRect({ top: 100, left: 100, width: 50, height: 20 }, viewport, 6)).toEqual({ top: 94, left: 94, width: 62, height: 32 });
  });

  it('clips to the viewport', () => {
    expect(spotlightRect({ top: -100, left: 1100, width: 300, height: 2000 }, viewport, 6)).toEqual({ top: 0, left: 1094, width: 106, height: 800 });
  });
});

describe('computeCardPosition', () => {
  it('uses the preferred side when it fits and centers on the target', () => {
    const position = computeCardPosition({ top: 300, left: 500, width: 100, height: 40 }, card, viewport, 'bottom');
    expect(position).toEqual({ side: 'bottom', top: 352, left: 400 });
  });

  it('falls back to the opposite side', () => {
    const position = computeCardPosition({ top: 700, left: 500, width: 100, height: 40 }, card, viewport, 'bottom');
    expect(position.side).toBe('top');
    expect(position.top).toBe(700 - 12 - 200);
  });

  it('prefers below/above for auto, beside only for tall targets', () => {
    expect(computeCardPosition({ top: 300, left: 1100, width: 80, height: 40 }, card, viewport, 'auto').side).toBe('bottom');
    expect(computeCardPosition({ top: 10, left: 1000, width: 190, height: 780 }, card, viewport, 'auto').side).toBe('left');
  });

  it('clamps the cross axis to the viewport margin', () => {
    const position = computeCardPosition({ top: 300, left: 1150, width: 40, height: 40 }, card, viewport, 'bottom');
    expect(position.left).toBe(1200 - 300 - 8);
    expect(computeCardPosition({ top: 300, left: 0, width: 20, height: 40 }, card, viewport, 'bottom').left).toBe(8);
  });

  it('overlays at the bottom when no side fits', () => {
    const position = computeCardPosition({ top: 0, left: 0, width: 1200, height: 800 }, card, viewport, 'top');
    expect(position).toEqual({ side: null, top: 800 - 200 - 8, left: 450 });
  });
});

describe('sheetEdge', () => {
  const phone = { width: 390, height: 800 };
  it('stays at the bottom unless the target would be covered', () => {
    expect(sheetEdge(null, 300, phone)).toBe('bottom');
    expect(sheetEdge({ top: 100, left: 0, width: 100, height: 50 }, 300, phone)).toBe('bottom');
    expect(sheetEdge({ top: 700, left: 0, width: 100, height: 50 }, 300, phone)).toBe('top');
    // Target fills the screen – nothing to gain at the top
    expect(sheetEdge({ top: 100, left: 0, width: 100, height: 650 }, 300, phone)).toBe('bottom');
  });
});

describe('isOutOfView', () => {
  it('detects targets outside the viewport', () => {
    expect(isOutOfView({ top: 100, left: 100, width: 10, height: 10 }, viewport)).toBe(false);
    expect(isOutOfView({ top: 900, left: 100, width: 10, height: 10 }, viewport)).toBe(true);
    expect(isOutOfView({ top: -20, left: 100, width: 10, height: 10 }, viewport)).toBe(true);
  });
});
