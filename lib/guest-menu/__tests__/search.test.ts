import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  countCustom,
  countTag,
  countWithout,
  createSearchEntry,
  matchEntry,
  parseShellUrlState,
  searchEntries,
  serializeShellUrlState,
  tokenize,
  tokenMatchesWord,
} from '../search';
import type { PublicMenuItemDto, PublicTagCategoryDto } from '../schema';

function item(id: string, overrides: Partial<PublicMenuItemDto> = {}): PublicMenuItemDto {
  return { id, name: id, nameOriginal: id, price: 10, priceFormatted: '10 €', unavailable: false, onRequest: false, highlight: null, ...overrides };
}

const categories: PublicTagCategoryDto[] = [
  { id: 'taste', name: 'Taste', order: 0, tags: [] },
  { id: 'base', name: 'Base', order: 1, tags: [] },
];
categories[0].tags = [
  { tag: 'sour', label: 'Sour', categoryId: 'taste', color: null, count: 2 },
  { tag: 'sweet', label: 'Sweet', categoryId: 'taste', color: null, count: 1 },
];
categories[1].tags = [
  { tag: 'gin', label: 'Gin', categoryId: 'base', color: null, count: 2 },
  { tag: 'rum', label: 'Rum', categoryId: 'base', color: null, count: 1 },
];

const entries = [
  item('Gin Sour', {
    facets: { tags: ['sour', 'gin'], alcoholCategory: 'medium', allergens: ['EGGS'], price: 11 },
    searchIndex: { ingredients: ['Gin', 'Zitrone'], tags: ['Sour'] },
  }),
  item('Daiquiri', {
    facets: { tags: ['sour', 'rum'], alcoholCategory: 'strong', allergens: [], price: 9 },
    searchIndex: { ingredients: ['Rum', 'Limette'], tags: [] },
  }),
  item('Bramble', { facets: { tags: ['sweet', 'gin'], alcoholCategory: 'medium', allergens: null, price: 12 }, unavailable: true }),
  item('Café Crème', { nameOriginal: 'Kaffee Sahne', facets: { tags: [], alcoholCategory: 'alcoholFree', allergens: ['MILK'], price: 4 } }),
].map((i, index) => createSearchEntry(i, 's1', index));

describe('search', () => {
  it('normalizes and matches prefixes and accents', () => {
    expect(tokenize('  Café  CRÈME ')).toEqual(['cafe', 'creme']);
    expect(matchEntry(entries[3], tokenize('cafe'))).toEqual({ kind: 'name', value: 'Café Crème' });
    expect(matchEntry(entries[3], tokenize('kaff'))).toEqual({ kind: 'originalName', value: 'Kaffee Sahne' });
  });

  it('tolerates one typo for tokens with ≥ 4 chars only', () => {
    expect(tokenMatchesWord('daiqiri', 'daiquiri')).toBe(true);
    expect(tokenMatchesWord('limete', 'limette')).toBe(true);
    expect(tokenMatchesWord('rux', 'rum')).toBe(false);
  });

  it('reports ingredient matches', () => {
    const results = searchEntries(entries, 'limette', EMPTY_FILTERS, categories);
    expect(results.map((r) => [r.entry.item.id, r.reason?.kind])).toEqual([['Daiquiri', 'ingredient']]);
  });

  it('requires all tokens and ranks unavailable last', () => {
    expect(searchEntries(entries, 'gin zitrone', EMPTY_FILTERS, categories).map((r) => r.entry.item.id)).toEqual(['Gin Sour']);
    expect(searchEntries(entries, '', EMPTY_FILTERS, categories).at(-1)?.entry.item.id).toBe('Bramble');
  });
});

describe('filters', () => {
  it('ORs within a category and ANDs between categories', () => {
    const filters = { ...EMPTY_FILTERS, tags: ['sour', 'sweet', 'gin'] };
    expect(searchEntries(entries, '', filters, categories).map((r) => r.entry.item.id)).toEqual(['Gin Sour', 'Bramble']);
  });

  it('"without" only matches complete items', () => {
    const filters = { ...EMPTY_FILTERS, without: ['EGGS' as const] };
    expect(searchEntries(entries, '', filters, categories).map((r) => r.entry.item.id)).toEqual(['Daiquiri', 'Café Crème']);
    expect(countWithout(entries, EMPTY_FILTERS, categories, 'MILK')).toBe(2);
  });

  it('counts facets excluding the own category', () => {
    const filters = { ...EMPTY_FILTERS, tags: ['gin'] };
    expect(countTag(entries, filters, categories, 'taste', 'sour')).toBe(1);
    expect(countTag(entries, filters, categories, 'base', 'rum')).toBe(1);
    expect(countTag(entries, { ...EMPTY_FILTERS, tags: ['rum'] }, categories, 'taste', 'sweet')).toBe(0);
  });

  it('filters by max price', () => {
    expect(searchEntries(entries, '', { ...EMPTY_FILTERS, maxPrice: 9 }, categories).map((r) => r.entry.item.id)).toEqual(['Daiquiri', 'Café Crème']);
  });
});

describe('url state', () => {
  it('round-trips and keeps other params', () => {
    const search = serializeShellUrlState('?lang=en', {
      query: 'gin',
      filters: { tags: ['sour', 'gin'], alcohol: ['light'], without: ['MILK'], maxPrice: 12, custom: ['f1'] },
    });
    expect(search).toBe('?lang=en&q=gin&tags=sour%2Cgin&alc=light&without=MILK&max=12&f=f1');
    expect(parseShellUrlState(search)).toEqual({
      query: 'gin',
      filters: { tags: ['sour', 'gin'], alcohol: ['light'], without: ['MILK'], maxPrice: 12, custom: ['f1'] },
    });
    expect(serializeShellUrlState('?lang=en&q=x', { query: '', filters: EMPTY_FILTERS })).toBe('?lang=en');
  });
});

describe('custom filters', () => {
  const custom = [
    item('Virgin Mojito', { facets: { tags: [], alcoholCategory: null, allergens: null, price: 8, custom: ['free', 'fruity'] } }),
    item('Raspberry Sour', { facets: { tags: [], alcoholCategory: null, allergens: null, price: 11, custom: ['fruity'] } }),
    item('Negroni', { facets: { tags: [], alcoholCategory: null, allergens: null, price: 10, custom: [] } }),
  ].map((entry, index) => createSearchEntry(entry, 's', index));

  it('narrows down with every selected custom filter (AND)', () => {
    expect(searchEntries(custom, '', { ...EMPTY_FILTERS, custom: ['fruity'] }, []).map((r) => r.entry.item.id)).toEqual(['Virgin Mojito', 'Raspberry Sour']);
    expect(searchEntries(custom, '', { ...EMPTY_FILTERS, custom: ['fruity', 'free'] }, []).map((r) => r.entry.item.id)).toEqual(['Virgin Mojito']);
  });

  it('counts each chip without its own selection', () => {
    expect(countCustom(custom, { ...EMPTY_FILTERS, custom: ['free'] }, [], 'fruity')).toBe(1);
    expect(countCustom(custom, { ...EMPTY_FILTERS, custom: ['free'] }, [], 'free')).toBe(1);
    expect(countCustom(custom, EMPTY_FILTERS, [], 'fruity')).toBe(2);
  });
});
