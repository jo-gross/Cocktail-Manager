import { describe, expect, it } from 'vitest';
import {
  createUnitToMlResolver,
  deriveCocktailGuestInfo,
  type GuestInfoCocktailInput,
  type GuestInfoIngredientInput,
  type GuestInfoStepInput,
  type UnitToMlResolver,
} from '../derive';

const units = [
  { id: 'cl', name: 'CL' },
  { id: 'g', name: 'GRAMM' },
  { id: 'spoon', name: 'BAR_SPOON' },
  { id: 'dash', name: 'DASH' },
  { id: 'piece', name: 'PIECE' },
];
// Mirrors the defaults of a new workspace (1 from = factor × to).
const conversions = [
  { fromUnitId: 'cl', toUnitId: 'g', factor: 10 },
  { fromUnitId: 'cl', toUnitId: 'spoon', factor: 2 },
  { fromUnitId: 'g', toUnitId: 'dash', factor: 1 },
];
const toMl = createUnitToMlResolver(units, conversions);

function ing(id: string, abv: number | null, extra: Partial<GuestInfoIngredientInput> = {}): GuestInfoIngredientInput {
  return { id, abv, allergens: [], additives: [], guestInfoComplete: true, ...extra };
}

function step(actionName: string, items: GuestInfoStepInput['ingredients'], extra: Partial<GuestInfoStepInput> = {}): GuestInfoStepInput {
  return { actionName, actionGroup: 'MIXING', dilutionPercent: null, optional: false, ingredients: items, ...extra };
}

function item(ingredient: GuestInfoIngredientInput | null, amount: number | null, unitId: string | null = 'cl', optional = false) {
  return { amount, unitId, unitName: null, optional, ingredient };
}

function cocktail(extra: Partial<GuestInfoCocktailInput>): GuestInfoCocktailInput {
  return { abvOverride: null, extraAllergens: [], extraAdditives: [], steps: [], garnishes: [], ...extra };
}

describe('createUnitToMlResolver', () => {
  it('resolves base units by name', () => {
    const r = createUnitToMlResolver(
      [
        { id: 'a', name: 'ml' },
        { id: 'b', name: 'CL' },
      ],
      [],
    );
    expect(r('a', null, null)).toBe(1);
    expect(r('b', null, null)).toBe(10);
  });

  it('resolves direct and transitive conversions in both directions', () => {
    expect(toMl('cl', null, null)).toBe(10);
    expect(toMl('g', null, null)).toBe(1);
    expect(toMl('spoon', null, null)).toBe(5);
    expect(toMl('dash', null, null)).toBe(1);
    const reverse = createUnitToMlResolver(
      [
        { id: 'cl', name: 'CL' },
        { id: 'oz', name: 'OZ' },
      ],
      [{ fromUnitId: 'oz', toUnitId: 'cl', factor: 3 }],
    );
    expect(reverse('oz', null, null)).toBe(30);
  });

  it('returns null for unknown units and falls back to the unit name', () => {
    expect(toMl('piece', null, null)).toBeNull();
    expect(toMl(null, null, null)).toBeNull();
    expect(toMl('missing', 'GRAMM', null)).toBe(1);
    expect(toMl(null, 'ml', null)).toBe(1);
  });

  it('ignores invalid factors', () => {
    const r = createUnitToMlResolver(units, [{ fromUnitId: 'cl', toUnitId: 'piece', factor: 0 }]);
    expect(r('piece', null, null)).toBeNull();
  });
});

describe('deriveCocktailGuestInfo – allergens & additives', () => {
  it('builds the union in legal order and marks optional-only codes', () => {
    const result = deriveCocktailGuestInfo(
      cocktail({
        extraAdditives: ['CAFFEINE'],
        steps: [
          step('SHAKE', [
            item(ing('a', 40, { allergens: ['SULPHITES'] }), 4),
            item(ing('b', 0, { allergens: ['EGGS', 'SULPHITES'], additives: ['COLORING'] }), 2, 'cl', true),
          ]),
          step('FLOAT', [item(ing('c', 0, { allergens: ['MILK'] }), 1)], { optional: true }),
        ],
        garnishes: [
          { optional: false, isAlternative: false, garnish: { allergens: ['NUTS'], additives: [], guestInfoComplete: true } },
          { optional: false, isAlternative: true, garnish: { allergens: ['GLUTEN'], additives: ['WAXED'], guestInfoComplete: true } },
        ],
      }),
      toMl,
    );
    expect(result.allergens).toEqual([
      { code: 'GLUTEN', optional: true, sources: [] },
      { code: 'EGGS', optional: true, sources: [] },
      { code: 'MILK', optional: true, sources: [] },
      { code: 'NUTS', optional: false, sources: [] },
      { code: 'SULPHITES', optional: false, sources: [] },
    ]);
    expect(result.additives).toEqual([
      { code: 'COLORING', optional: true },
      { code: 'WAXED', optional: true },
      { code: 'CAFFEINE', optional: false },
    ]);
    expect(result.complete).toBe(true);
  });

  it('extra allergens are never optional', () => {
    const result = deriveCocktailGuestInfo(
      cocktail({
        extraAllergens: ['EGGS'],
        steps: [step('SHAKE', [item(ing('a', 0, { allergens: ['EGGS'] }), 2, 'cl', true)])],
      }),
      toMl,
    );
    expect(result.allergens).toEqual([{ code: 'EGGS', optional: false, sources: [] }]);
  });

  it('merges the specified cereals/nuts of all components in legal order', () => {
    const result = deriveCocktailGuestInfo(
      cocktail({
        extraAllergens: ['GLUTEN'],
        steps: [
          step('SHAKE', [
            item(ing('whisky', 40, { allergens: ['GLUTEN'], allergenSources: ['BARLEY'] }), 4),
            item(ing('orgeat', 0, { allergens: ['NUTS'], allergenSources: ['ALMONDS'] }), 2),
          ]),
        ],
        garnishes: [
          {
            optional: false,
            isAlternative: false,
            // A source without its allergen (stale data) is ignored.
            garnish: { allergens: ['GLUTEN'], allergenSources: ['WHEAT', 'HAZELNUTS'], additives: [], guestInfoComplete: true },
          },
        ],
      }),
      toMl,
    );
    expect(result.allergens).toEqual([
      { code: 'GLUTEN', optional: false, sources: ['WHEAT', 'BARLEY'] },
      { code: 'NUTS', optional: false, sources: ['ALMONDS'] },
    ]);
  });

  it('is incomplete if any involved ingredient or garnish is incomplete', () => {
    const incompleteIngredient = deriveCocktailGuestInfo(
      cocktail({ steps: [step('STIR', [item(ing('a', 40, { guestInfoComplete: false }), 4, 'cl', true)])] }),
      toMl,
    );
    expect(incompleteIngredient.complete).toBe(false);
    const incompleteGarnish = deriveCocktailGuestInfo(
      cocktail({ garnishes: [{ optional: true, isAlternative: false, garnish: { allergens: [], additives: [], guestInfoComplete: false } }] }),
      toMl,
    );
    expect(incompleteGarnish.complete).toBe(false);
  });

  it('ignores null ingredients', () => {
    const result = deriveCocktailGuestInfo(cocktail({ steps: [step('STIR', [item(null, null, null), item(ing('a', 40), 5)])] }), toMl);
    expect(result.complete).toBe(true);
    expect(result.alcohol.status).toBe('calculated');
  });
});

describe('deriveCocktailGuestInfo – alcohol', () => {
  it('calculates ABV with the default shake dilution', () => {
    // 5 cl @ 40 % + 3 cl @ 0 % = 80 ml, 20 ml alcohol, ×1.25 dilution → 100 ml
    const result = deriveCocktailGuestInfo(
      cocktail({ steps: [step('SHAKE', [item(ing('gin', 40), 5), item(ing('lemon', 0), 3)]), step('DOUBLE_STRAIN', [])] }),
      toMl,
    );
    expect(result.alcohol).toEqual({
      abv: 20,
      status: 'calculated',
      category: 'medium',
      alcoholFree: false,
      grams: 15.8,
      volumeMl: 100,
    });
  });

  it('uses the maximum dilution across steps and respects explicit dilutionPercent', () => {
    // 6 cl @ 40 % → 24 ml alcohol, dilution 50 % → 90 ml
    const result = deriveCocktailGuestInfo(
      cocktail({ steps: [step('BUILD_IN_GLASS', [item(ing('a', 40), 6)]), step('STIR', [], { dilutionPercent: 50 })] }),
      toMl,
    );
    expect(result.alcohol.volumeMl).toBe(90);
    expect(result.alcohol.abv).toBe(26.7);
    expect(result.alcohol.category).toBe('strong');
  });

  it('allows 0 % dilution', () => {
    const result = deriveCocktailGuestInfo(cocktail({ steps: [step('WITHOUT', [item(ing('a', 12), 10)], { dilutionPercent: 0 })] }), toMl);
    expect(result.alcohol.abv).toBe(12);
    expect(result.alcohol.category).toBe('medium');
  });

  it('converts units via the resolver', () => {
    // 2 bar spoons = 10 ml @ 50 %, 2 dash = 2 ml @ 0 %; no dilution
    const result = deriveCocktailGuestInfo(
      cocktail({ steps: [step('BUILD', [item(ing('a', 50), 2, 'spoon'), item(ing('b', 0), 2, 'dash')], { dilutionPercent: 0 })] }),
      toMl,
    );
    expect(result.alcohol.volumeMl).toBe(12);
    expect(result.alcohol.abv).toBe(41.7);
  });

  it('is unknown if a required ingredient lacks ABV, amount or convertible unit', () => {
    const missingAbv = deriveCocktailGuestInfo(cocktail({ steps: [step('SHAKE', [item(ing('a', null), 4)])] }), toMl);
    expect(missingAbv.alcohol).toEqual({ abv: null, status: 'unknown', category: null, alcoholFree: false, grams: null, volumeMl: null });
    const missingAmount = deriveCocktailGuestInfo(cocktail({ steps: [step('SHAKE', [item(ing('a', 0), null)])] }), toMl);
    expect(missingAmount.alcohol.status).toBe('unknown');
    const piece = deriveCocktailGuestInfo(cocktail({ steps: [step('SHAKE', [item(ing('a', 0), 1, 'piece')])] }), toMl);
    expect(piece.alcohol.status).toBe('unknown');
    expect(piece.alcohol.alcoholFree).toBe(false);
  });

  it('ignores optional ingredients and optional steps for ABV', () => {
    const result = deriveCocktailGuestInfo(
      cocktail({
        steps: [
          step('STIR', [item(ing('juice', 0), 10), item(ing('rum', null), 2, 'cl', true)], { dilutionPercent: 0 }),
          step('FLOAT', [item(ing('overproof', null), 1)], { optional: true, dilutionPercent: 100 }),
        ],
      }),
      toMl,
    );
    expect(result.alcohol.status).toBe('calculated');
    expect(result.alcohol.abv).toBe(0);
    expect(result.alcohol.alcoholFree).toBe(true);
    expect(result.alcohol.category).toBe('alcoholFree');
    expect(result.alcohol.volumeMl).toBe(100);
  });

  it('treats ≤ 0.5 % as alcohol-free', () => {
    const result = deriveCocktailGuestInfo(cocktail({ steps: [step('WITHOUT', [item(ing('beer', 0.5), 30)], { dilutionPercent: 0 })] }), toMl);
    expect(result.alcohol.alcoholFree).toBe(true);
    const light = deriveCocktailGuestInfo(cocktail({ steps: [step('WITHOUT', [item(ing('beer', 0.6), 30)], { dilutionPercent: 0 })] }), toMl);
    expect(light.alcohol.alcoholFree).toBe(false);
    expect(light.alcohol.category).toBe('light');
  });

  it('uses abvOverride as manual status even if ingredients are unknown', () => {
    const result = deriveCocktailGuestInfo(cocktail({ abvOverride: 0, steps: [step('SHAKE', [item(ing('a', null), 4)])] }), toMl);
    expect(result.alcohol).toEqual({ abv: 0, status: 'manual', category: 'alcoholFree', alcoholFree: true, grams: null, volumeMl: null });
  });

  it('computes grams from the volume for manual ABV when the volume is known', () => {
    const result = deriveCocktailGuestInfo(cocktail({ abvOverride: 10, steps: [step('WITHOUT', [item(ing('a', 40), 10)], { dilutionPercent: 0 })] }), toMl);
    expect(result.alcohol.status).toBe('manual');
    expect(result.alcohol.volumeMl).toBe(100);
    expect(result.alcohol.grams).toBe(7.9);
  });

  it('is unknown (never alcohol-free) for a cocktail without measured ingredients', () => {
    const empty: UnitToMlResolver = () => null;
    const result = deriveCocktailGuestInfo(cocktail({}), empty);
    expect(result.alcohol.status).toBe('unknown');
    expect(result.alcohol.alcoholFree).toBe(false);
    expect(result.complete).toBe(true);
  });
});
