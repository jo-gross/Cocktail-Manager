import { describe, expect, it } from 'vitest';
import {
  emptyTemplateSelection,
  matchesSearch,
  resolveTemplateSelection,
  setTemplatePicks,
  templatesForLocale,
  toggleTemplatePick,
  totalSelected,
  type SelectableTemplateItems,
} from '../templateSelection';

const items: SelectableTemplateItems = {
  glasses: [
    { id: 'g-coupe', name: 'Coupe' },
    { id: 'g-rocks', name: 'Tumbler' },
  ],
  ingredients: [
    { id: 'i-gin', name: 'Gin' },
    { id: 'i-lime', name: 'Limettensaft' },
    { id: 'i-sugar', name: 'Zuckersirup' },
    { id: 'i-rum', name: 'Rum' },
  ],
  garnishes: [{ id: 'ga-lime', name: 'Limettenzeste' }],
  cocktails: [
    { id: 'c-gimlet', name: 'Gimlet', glassId: 'g-coupe', ingredientIds: ['i-gin', 'i-lime', 'i-sugar'], garnishIds: ['ga-lime'] },
    { id: 'c-daiquiri', name: 'Daiquiri', glassId: 'g-coupe', ingredientIds: ['i-rum', 'i-lime', 'i-sugar'], garnishIds: [] },
    { id: 'c-neat', name: 'Rum pur', glassId: null, ingredientIds: ['i-rum'], garnishIds: [] },
  ],
  cards: [{ id: 'k-sours', name: 'Sours', cocktailIds: ['c-gimlet', 'c-daiquiri'] }],
};

describe('resolveTemplateSelection', () => {
  it('adds glass, ingredients and garnishes of a selected cocktail', () => {
    const picked = { ...emptyTemplateSelection(), cocktails: ['c-gimlet'] };
    const { selected, requiredBy, counts } = resolveTemplateSelection(items, picked);

    expect([...selected.glasses]).toEqual(['g-coupe']);
    expect([...selected.ingredients].sort()).toEqual(['i-gin', 'i-lime', 'i-sugar']);
    expect([...selected.garnishes]).toEqual(['ga-lime']);
    expect(requiredBy.ingredients.get('i-gin')).toEqual(['Gimlet']);
    expect(counts).toEqual({ glasses: 1, ingredients: 3, garnishes: 1, cocktails: 1, cards: 0 });
    expect(totalSelected(counts)).toBe(6);
  });

  it('adds the cocktails of a card and their dependencies, naming every dependent once', () => {
    const picked = { ...emptyTemplateSelection(), cards: ['k-sours'] };
    const { selected, requiredBy } = resolveTemplateSelection(items, picked);

    expect([...selected.cocktails].sort()).toEqual(['c-daiquiri', 'c-gimlet']);
    expect(requiredBy.cocktails.get('c-gimlet')).toEqual(['Sours']);
    expect(requiredBy.ingredients.get('i-lime')).toEqual(['Gimlet', 'Daiquiri']);
    expect(requiredBy.glasses.get('g-coupe')).toEqual(['Gimlet', 'Daiquiri']);
    expect(selected.ingredients.has('i-rum')).toBe(true);
  });

  it('does not mark explicitly picked items as required', () => {
    const picked = { ...emptyTemplateSelection(), cocktails: ['c-gimlet'], ingredients: ['i-gin'] };
    const { requiredBy, selected } = resolveTemplateSelection(items, picked);

    expect(selected.ingredients.has('i-gin')).toBe(true);
    expect(requiredBy.ingredients.has('i-gin')).toBe(false);
    expect(requiredBy.ingredients.has('i-lime')).toBe(true);
  });

  it('ignores unknown ids and cocktails without glass', () => {
    const picked = { ...emptyTemplateSelection(), cocktails: ['c-neat', 'missing'], glasses: ['nope'] };
    const { counts } = resolveTemplateSelection(items, picked);

    expect(counts).toEqual({ glasses: 0, ingredients: 1, garnishes: 0, cocktails: 1, cards: 0 });
  });

  it('keeps a required item after unpicking it explicitly', () => {
    let picked = { ...emptyTemplateSelection(), cocktails: ['c-gimlet'], glasses: ['g-coupe'] };
    picked = toggleTemplatePick(picked, 'glasses', 'g-coupe', false);
    const { selected, requiredBy } = resolveTemplateSelection(items, picked);

    expect(picked.glasses).toEqual([]);
    expect(selected.glasses.has('g-coupe')).toBe(true);
    expect(requiredBy.glasses.get('g-coupe')).toEqual(['Gimlet']);
  });
});

describe('pick helpers', () => {
  it('toggles single items without duplicates', () => {
    let picked = emptyTemplateSelection();
    picked = toggleTemplatePick(picked, 'ingredients', 'i-gin', true);
    picked = toggleTemplatePick(picked, 'ingredients', 'i-gin', true);
    expect(picked.ingredients).toEqual(['i-gin']);
    expect(toggleTemplatePick(picked, 'ingredients', 'i-gin', false).ingredients).toEqual([]);
  });

  it('picks and unpicks a filtered list', () => {
    const picked = setTemplatePicks({ ...emptyTemplateSelection(), ingredients: ['i-gin'] }, 'ingredients', ['i-gin', 'i-rum'], true);
    expect(picked.ingredients).toEqual(['i-gin', 'i-rum']);
    expect(setTemplatePicks(picked, 'ingredients', ['i-rum'], false).ingredients).toEqual(['i-gin']);
  });
});

describe('matchesSearch', () => {
  it('ignores case and accents', () => {
    expect(matchesSearch('Crème de Cassis', 'creme')).toBe(true);
    expect(matchesSearch('Gin', '  ')).toBe(true);
    expect(matchesSearch('Gin', 'rum')).toBe(false);
  });
});

describe('templatesForLocale', () => {
  const de = { key: 'classics', locales: ['de', 'en'] };
  const fr = { key: 'paris', locales: ['fr'] };

  it('offers the templates of the content language', () => {
    expect(templatesForLocale([de, fr], 'en')).toEqual({ templates: [de], otherLanguage: false });
    expect(templatesForLocale([de, fr], 'de-AT')).toEqual({ templates: [de], otherLanguage: false });
  });

  it('falls back to all templates when none matches', () => {
    expect(templatesForLocale([de, fr], 'it')).toEqual({ templates: [de, fr], otherLanguage: true });
    expect(templatesForLocale([], 'it')).toEqual({ templates: [], otherLanguage: false });
  });
});
