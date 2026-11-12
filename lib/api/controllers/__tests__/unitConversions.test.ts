import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../prisma/prisma', () => ({ default: {} }));

const { deriveUnitConversions } = await import('@lib/api/controllers/units');

describe('deriveUnitConversions', () => {
  it('derives inverses and transitive conversions along the shortest path', () => {
    const derived = deriveUnitConversions(
      ['ml', 'cl', 'l'],
      [
        { fromUnitId: 'cl', toUnitId: 'ml', factor: 10 },
        { fromUnitId: 'l', toUnitId: 'cl', factor: 100 },
      ],
    );
    const factor = (from: string, to: string) => derived.find((c) => c.fromUnitId === from && c.toUnitId === to)?.factor;
    expect(derived).toHaveLength(4);
    expect(factor('ml', 'cl')).toBe(0.1);
    expect(factor('cl', 'l')).toBe(0.01);
    expect(factor('l', 'ml')).toBe(1000);
    expect(factor('ml', 'l')).toBeCloseTo(0.001);
  });

  it('never derives a pair that already has a conversion and skips unconnected units', () => {
    const derived = deriveUnitConversions(
      ['a', 'b', 'c'],
      [
        { fromUnitId: 'a', toUnitId: 'b', factor: 2 },
        { fromUnitId: 'b', toUnitId: 'a', factor: 0.4 },
      ],
    );
    expect(derived).toEqual([]);
  });

  it('produces each ordered pair at most once', () => {
    const units = ['u0', 'u1', 'u2', 'u3', 'u4'];
    const manual = [
      { fromUnitId: 'u0', toUnitId: 'u1', factor: 2 },
      { fromUnitId: 'u1', toUnitId: 'u2', factor: 2 },
      { fromUnitId: 'u0', toUnitId: 'u3', factor: 3 },
      { fromUnitId: 'u3', toUnitId: 'u4', factor: 5 },
    ];
    const derived = deriveUnitConversions(units, manual);
    const keys = [...manual, ...derived].map((c) => `${c.fromUnitId}->${c.toUnitId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(units.length * (units.length - 1));
  });
});
