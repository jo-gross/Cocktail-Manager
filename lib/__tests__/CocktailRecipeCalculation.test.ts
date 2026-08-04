import { describe, it, expect } from 'vitest';
import { calcCocktailTotalPrice, type PriceCalcCocktail } from '../CocktailRecipeCalculation';
import type { IngredientModel } from '../../models/IngredientModel';

/**
 * Guards the v1 cocktails-GET migration's single silent-failure risk: `calcCocktailTotalPrice` is
 * called with a Prisma-shaped cocktail (calc page / edit form — FK ids `ingredientId`/`unitId`) AND
 * with the v1 `CocktailDto` (detail modal — nested `{ id }` refs, no embedded ingredient price).
 * Both must compute the identical price, with ingredient price sourced from the `ingredients` list and
 * garnish price sourced from the (enriched) embedded garnish ref.
 */
const ingredients: IngredientModel[] = [
  {
    id: 'ingA',
    name: 'A',
    shortName: null,
    description: null,
    notes: null,
    price: 10, // 10 per 1000 ml → 0.01 / ml
    link: null,
    tags: [],
    volumes: [{ id: 'vA', volume: 1000, unit: { id: 'ml', name: 'ml' } }],
    hasImage: false,
    imageUrl: null,
  },
  {
    id: 'ingB',
    name: 'B',
    shortName: null,
    description: null,
    notes: null,
    price: 20, // 20 per 500 ml → 0.04 / ml
    link: null,
    tags: [],
    volumes: [{ id: 'vB', volume: 500, unit: { id: 'ml', name: 'ml' } }],
    hasImage: false,
    imageUrl: null,
  },
];

// (10/1000)*50 + (20/500)*25 + garnish 0.5 (alternative 99 excluded) = 0.5 + 1.0 + 0.5 = 2.0
const EXPECTED_TOTAL = 2.0;

/** Prisma shape: FK ids present; no embedded ingredient price (proves the list is the price source). */
const prismaShape: PriceCalcCocktail = {
  steps: [
    {
      ingredients: [
        { amount: 50, ingredientId: 'ingA', unitId: 'ml', ingredient: { id: 'ingA' }, unit: { id: 'ml' } },
        { amount: 25, ingredientId: 'ingB', unitId: 'ml', ingredient: { id: 'ingB' }, unit: { id: 'ml' } },
      ],
    },
  ],
  garnishes: [
    { isAlternative: false, garnishId: 'g1', garnish: { id: 'g1', price: 0.5 } },
    { isAlternative: true, garnishId: 'g2', garnish: { id: 'g2', price: 99 } },
  ],
};

/** v1 DTO shape: nested `{ id }` refs, NO `ingredientId`/`unitId`, garnish price on the enriched ref. */
const dtoShape: PriceCalcCocktail = {
  steps: [
    {
      ingredients: [
        { amount: 50, ingredient: { id: 'ingA' }, unit: { id: 'ml' } },
        { amount: 25, ingredient: { id: 'ingB' }, unit: { id: 'ml' } },
      ],
    },
  ],
  garnishes: [
    { isAlternative: false, garnish: { id: 'g1', price: 0.5 } },
    { isAlternative: true, garnish: { id: 'g2', price: 99 } },
  ],
};

describe('calcCocktailTotalPrice', () => {
  it('computes the same price for the Prisma FK shape and the v1 DTO ref shape', () => {
    expect(calcCocktailTotalPrice(prismaShape, ingredients)).toBeCloseTo(EXPECTED_TOTAL);
    expect(calcCocktailTotalPrice(dtoShape, ingredients)).toBeCloseTo(EXPECTED_TOTAL);
  });

  it('includes non-alternative garnish price and excludes alternatives', () => {
    const noGarnish: PriceCalcCocktail = { ...dtoShape, garnishes: [] };
    // Without the 0.5 garnish (and never the 99 alternative): 0.5 + 1.0 = 1.5
    expect(calcCocktailTotalPrice(noGarnish, ingredients)).toBeCloseTo(1.5);
  });

  it('returns 0 for an ingredient/unit combination with no matching volume', () => {
    const badUnit: PriceCalcCocktail = {
      steps: [{ ingredients: [{ amount: 50, ingredient: { id: 'ingA' }, unit: { id: 'cl' } }] }],
      garnishes: [],
    };
    expect(calcCocktailTotalPrice(badUnit, ingredients)).toBe(0);
  });

  it('handles null garnish price without breaking the total', () => {
    const nullGarnishPrice: PriceCalcCocktail = {
      ...dtoShape,
      garnishes: [{ isAlternative: false, garnish: { id: 'g1', price: null } }],
    };
    // garnish contributes 0 → just the ingredient cost 1.5
    expect(calcCocktailTotalPrice(nullGarnishPrice, ingredients)).toBeCloseTo(1.5);
  });
});
