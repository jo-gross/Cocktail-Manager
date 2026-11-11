import { describe, expect, it } from 'vitest';
import { buildPublicMenuDto, pickContentLocale } from '../resolveCore';
import type { PublicMenuItemDto, PublicSectionDto } from '../schema';
import { buildInput, cocktail, guestInfo, manualDocument, resolverData } from './fixtures';

function sections(dto: ReturnType<typeof buildPublicMenuDto>['dto']): PublicSectionDto[] {
  return dto.blocks.filter((b): b is PublicSectionDto & { type: 'section' } => b.type === 'section');
}

function items(dto: ReturnType<typeof buildPublicMenuDto>['dto']): PublicMenuItemDto[] {
  return sections(dto).flatMap((s) => s.items);
}

const secretIngredient = {
  id: 'ing-secret',
  name: 'House Syrup',
  guestName: null,
  tags: ['internal'],
  hideOnGuestMenu: true,
  translations: [],
};
const gin = {
  id: 'ing-gin',
  name: 'Gin (Brand X 0.7l)',
  guestName: 'Gin',
  tags: ['juniper'],
  hideOnGuestMenu: false,
  translations: [{ locale: 'en', name: 'Gin EN', guestName: null }],
};

describe('buildPublicMenuDto – privacy', () => {
  const c = cocktail({
    id: 'c1',
    name: 'Negroni',
    tags: ['bitter', 'secret-tag'],
    steps: [
      {
        optional: false,
        ingredients: [
          { optional: false, amount: 3, unitName: 'CL', ingredient: gin },
          { optional: false, amount: 1, unitName: 'CL', ingredient: secretIngredient },
        ],
      },
    ],
  });
  const data = resolverData([c, cocktail({ id: 'archived', isArchived: true })], {
    tagDefinitions: [
      { tag: 'secret-tag', label: null, categoryId: null, color: null, isPublic: false },
      { tag: 'internal', label: null, categoryId: null, color: null, isPublic: false },
    ],
  });

  it('never emits amounts unless enabled, hidden ingredients or private tags', () => {
    const { dto } = buildPublicMenuDto(buildInput(manualDocument(['c1', 'archived'])), data);
    const json = JSON.stringify(dto);
    expect(json).not.toContain('House Syrup');
    expect(json).not.toContain('secret-tag');
    expect(json).not.toContain('internal');
    expect(json).not.toContain('Brand X');
    const [item] = items(dto);
    expect(item.amounts).toBeUndefined();
    expect(item.ingredients).toEqual([{ name: 'Gin', optional: false }]);
    expect(item.tags?.map((t) => t.tag)).toEqual(['bitter']);
  });

  it('hides archived cocktails', () => {
    const { dto } = buildPublicMenuDto(buildInput(manualDocument(['c1', 'archived'])), data);
    expect(items(dto).map((i) => i.id)).toEqual(['c1']);
  });

  it('emits amounts only with fields.amounts and still hides hidden ingredients', () => {
    const doc = manualDocument(['c1'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, amounts: 'detail' };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    expect(items(dto)[0].amounts).toEqual([{ name: 'Gin', amount: 3, unit: 'CL', optional: false }]);
  });

  it('omits fields set to off', () => {
    const doc = manualDocument(['c1'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, ingredients: 'off', price: 'off', description: 'off', flavors: 'off' };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const [item] = items(dto);
    expect(item.ingredients).toBeUndefined();
    expect(item.price).toBeNull();
    expect(item.priceFormatted).toBeNull();
    expect('description' in item).toBe(false);
    expect(item.tags).toBeUndefined();
  });

  it('only exposes the price facet when the price is shown', () => {
    const hidden = manualDocument(['c1'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, price: 'off' };
    });
    expect(items(buildPublicMenuDto(buildInput(hidden), data).dto)[0].facets?.price).toBeNull();
    const shown = manualDocument(['c1']);
    const [item] = items(buildPublicMenuDto(buildInput(shown), data).dto);
    expect(item.price).not.toBeNull();
    expect(item.facets?.price).toBe(item.price);
  });
});

describe('buildPublicMenuDto – price precedence', () => {
  const data = resolverData(
    [cocktail({ id: 'a', price: 9 }), cocktail({ id: 'b', price: 9 }), cocktail({ id: 'c', price: 9 }), cocktail({ id: 'd', price: 9 })],
    {
      sourceCard: {
        id: 'card',
        name: 'Card',
        groups: [
          {
            id: 'g1',
            name: 'Classics',
            groupNumber: 1,
            groupPrice: 11,
            items: [
              { cocktailId: 'a', itemNumber: 1, specialPrice: null },
              { cocktailId: 'b', itemNumber: 2, specialPrice: 12 },
              { cocktailId: 'c', itemNumber: 3, specialPrice: 12 },
            ],
          },
          { id: 'g2', name: 'Plain', groupNumber: 2, groupPrice: null, items: [{ cocktailId: 'd', itemNumber: 1, specialPrice: null }] },
        ],
      },
    },
  );

  it('cocktail → group → special → override', () => {
    const doc = manualDocument([], (d) => {
      d.blocks[1] = { id: 'all', type: 'section', title: {}, source: { kind: 'cardAllGroups' }, overrides: { c: { price: 15 } } };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const prices = Object.fromEntries(items(dto).map((i) => [i.id, i.price]));
    expect(prices).toEqual({ a: 11, b: 12, c: 15, d: 9 });
    expect(items(dto).find((i) => i.id === 'a')?.priceFormatted).toMatch(/11,00\s?€/);
    expect(sections(dto).map((s) => [s.id, s.title])).toEqual([
      ['all:g1', 'Classics'],
      ['all:g2', 'Plain'],
    ]);
  });

  it('override price null hides the price', () => {
    const doc = manualDocument(['d'], (d) => {
      (d.blocks[1] as { overrides: object }).overrides = { d: { price: null } };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    expect(items(dto)[0].price).toBeNull();
  });
});

describe('buildPublicMenuDto – translations', () => {
  const c = cocktail({
    id: 'c1',
    name: 'Zitronen-Sour',
    description: 'Sauer',
    translations: [{ locale: 'en', name: 'Lemon Sour', description: null, history: null }],
    steps: [{ optional: true, ingredients: [{ optional: false, amount: 4, unitName: 'CL', ingredient: gin }] }],
  });
  const data = resolverData([c]);

  it('uses the requested locale and falls back to the primary value', () => {
    const doc = manualDocument(['c1'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, description: 'list' };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc, { locale: 'en-GB' }), data);
    expect(dto.locale).toBe('en');
    expect(dto.uiLocale).toBe('en');
    const [item] = items(dto);
    expect(item.name).toBe('Lemon Sour');
    expect(item.nameOriginal).toBe('Zitronen-Sour');
    expect(item.description).toBe('Sauer');
    expect(item.ingredients).toEqual([{ name: 'Gin EN', optional: true }]);
    expect(sections(dto)[0].title).toBe('Drinks EN');
    expect(item.searchIndex?.ingredients.sort()).toEqual(['Gin', 'Gin EN']);
  });

  it('unknown locales fall back to the primary locale', () => {
    expect(pickContentLocale('fr', ['de', 'en'], 'de')).toBe('de');
    const { dto } = buildPublicMenuDto(buildInput(manualDocument(['c1']), { locale: 'fr' }), data);
    expect(items(dto)[0].name).toBe('Zitronen-Sour');
    expect(dto.uiLocale).toBe('de');
  });
});

describe('buildPublicMenuDto – availability, on request, guest info', () => {
  const data = resolverData(
    [
      cocktail({ id: 'out', name: 'A', unavailableUntil: '2026-11-11T05:00:00Z' }),
      cocktail({ id: 'in', name: 'B' }),
      cocktail({ id: 'extra', name: 'C' }),
      cocktail({ id: 'gone', name: 'D', isArchived: true }),
    ],
    {
      guestInfo: new Map([
        ['in', guestInfo({ allergens: [{ code: 'MILK', optional: false, sources: [] }], additives: [{ code: 'CAFFEINE', optional: true }] })],
        ['out', guestInfo({ complete: false, alcohol: { abv: 0, status: 'calculated', category: 'alcoholFree', alcoholFree: true, grams: 0, volumeMl: 100 } })],
      ]),
    },
  );

  it('moves unavailable items to the end with a badge', () => {
    const { dto } = buildPublicMenuDto(buildInput(manualDocument(['out', 'in'])), data);
    const list = items(dto);
    expect(list.map((i) => i.id)).toEqual(['in', 'out']);
    expect(list[1].unavailable).toBe(true);
    expect(list[1].badges?.map((b) => b.kind)).toContain('unavailable');
    expect(list[1].badges?.map((b) => b.kind)).toContain('alcoholFree');
  });

  it('adds on-request items only when enabled (never archived)', () => {
    expect(buildPublicMenuDto(buildInput(manualDocument(['in'])), data).dto.onRequestItems).toBeUndefined();
    const doc = manualDocument(['in'], (d) => {
      d.outputs.web.search.includeOnRequest = true;
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    expect(dto.onRequestItems?.map((i) => i.id)).toEqual(['out', 'extra']);
    expect(dto.onRequestItems?.every((i) => i.onRequest)).toBe(true);
  });

  it('builds facets and footnotes from guest info', () => {
    const doc = manualDocument(['in', 'out'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, allergenDisplay: 'footnotes', additives: 'list' };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const [first, second] = items(dto);
    expect(first.facets?.allergens).toEqual(['MILK']);
    expect(second.facets?.allergens).toBeNull();
    expect(dto.filters.allergens).toEqual(['MILK']);
    expect(dto.filters.alcoholCategories).toEqual(['alcoholFree', 'medium']);
    expect(dto.footnotes.allergens.map((a) => a.short)).toEqual(['G']);
    expect(dto.footnotes.additives.map((a) => a.number)).toEqual([11]);
    expect(first.allergens?.[0]).toMatchObject({ code: 'MILK', short: 'G', optional: false });
  });

  it('names the specified cereals/nuts per item and merges them in the footnote legend', () => {
    const withSources = resolverData([cocktail({ id: 'sour', name: 'Whisky Sour' }), cocktail({ id: 'mule', name: 'Moscow Mule' })], {
      guestInfo: new Map([
        ['sour', guestInfo({ allergens: [{ code: 'GLUTEN', optional: false, sources: ['BARLEY'] }] })],
        ['mule', guestInfo({ allergens: [{ code: 'GLUTEN', optional: false, sources: ['WHEAT'] }] })],
      ]),
    });
    const doc = manualDocument(['sour', 'mule'], (d) => {
      d.outputs.web.fields = { ...d.outputs.web.fields, allergenDisplay: 'footnotes' };
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), withSources);
    expect(items(dto).map((item) => item.allergens?.[0].label)).toEqual(['Glutenhaltiges Getreide (Gerste)', 'Glutenhaltiges Getreide (Weizen)']);
    expect(dto.footnotes.allergens).toEqual([expect.objectContaining({ short: 'A', label: 'Glutenhaltiges Getreide (Weizen, Gerste)' })]);
  });

  it('normalizes field modes for monitor/print', () => {
    const { dto } = buildPublicMenuDto(buildInput(manualDocument(['in']), { output: 'print' }), data);
    expect(dto.fields.description).not.toBe('detail');
    expect(Object.values(dto.fields)).not.toContain('expandable');
    expect(items(dto)[0].facets).toBeUndefined();
    expect(items(dto)[0].searchIndex).toBeUndefined();
  });
});

describe('buildPublicMenuDto – images', () => {
  it.each(['web', 'monitor', 'print'] as const)('falls back to the workspace logo for %s, using the guarded public endpoint', (output) => {
    const input = buildInput(manualDocument([]), { output, previewToken: 'draft token' });
    input.workspace.hasImage = true;
    const { dto, meta } = buildPublicMenuDto(input, resolverData([]));
    expect(dto.theme.logoUrl).toBe('/api/public/images/bar/workspace-logo/ws1?preview=draft%20token');
    expect(meta.workspaceLogo).toBe(true);
    expect(meta.menuAssets).not.toContain('logo');
  });

  it.each(['data:image/png;base64,AAAA', '/custom-logo.png'])('never replaces a custom menu logo (%s)', (logo) => {
    const input = buildInput(
      manualDocument([], (doc) => {
        doc.theme.logo = logo;
      }),
    );
    input.workspace.hasImage = true;
    const { dto, meta } = buildPublicMenuDto(input, resolverData([]));
    expect(dto.theme.logoUrl).toBe(logo.startsWith('data:') ? '/api/public/images/bar/menu-asset/menu1~logo' : logo);
    expect(meta.workspaceLogo).toBe(false);
  });

  it('has no logo when neither menu nor workspace supplies one', () => {
    const { dto, meta } = buildPublicMenuDto(buildInput(manualDocument([])), resolverData([]));
    expect(dto.theme.logoUrl).toBeNull();
    expect(meta.workspaceLogo).toBe(false);
  });

  it('uses the public image endpoint and reports referenced images', () => {
    const data = resolverData([cocktail({ id: 'c1', hasImage: true })]);
    const doc = manualDocument(['c1'], (d) => {
      d.theme.logo = 'data:image/png;base64,AAAA';
      d.theme.backgroundImage = 'https://tracker.example/bg.png';
    });
    const { dto, meta } = buildPublicMenuDto(buildInput(doc, { previewToken: 'tok' }), data);
    expect(items(dto)[0].imageUrl).toBe('/api/public/images/bar/cocktail/c1?preview=tok');
    expect(dto.theme.logoUrl).toBe('/api/public/images/bar/menu-asset/menu1~logo?preview=tok');
    expect(dto.theme.backgroundImageUrl).toBeNull();
    expect(meta.cocktailImageIds).toEqual(['c1']);
    expect(meta.menuAssets).toEqual(['logo']);
  });
});

describe('buildPublicMenuDto – custom filters', () => {
  const raspberry = { id: 'ing-rasp', name: 'Himbeere', guestName: null, tags: ['himbeere'], hideOnGuestMenu: false, translations: [] };
  const data = resolverData(
    [
      cocktail({ id: 'c1', name: 'Virgin Mojito', tags: ['mocktail'] }),
      cocktail({
        id: 'c2',
        name: 'Raspberry Sour',
        steps: [{ optional: false, ingredients: [{ optional: false, amount: 2, unitName: 'CL', ingredient: raspberry }] }],
      }),
      cocktail({ id: 'c3', name: 'Negroni', tags: ['bitter'] }),
    ],
    { tagDefinitions: [{ tag: 'mocktail', label: null, categoryId: null, color: null, isPublic: false }] },
  );
  const doc = manualDocument(['c1', 'c2', 'c3'], (d) => {
    d.outputs.web.filters.custom = [
      { id: 'free', label: { de: 'Alkoholfrei' }, tags: ['alkoholfrei', 'Mocktail'] },
      { id: 'fruity', label: { de: 'Fruchtig' }, tags: ['fruchtig', 'himbeere'], quick: false },
      { id: 'smoky', label: { de: 'Rauchig' }, tags: ['rauchig'] },
      { id: 'empty', label: { de: 'Leer' }, tags: [] },
    ];
    d.outputs.web.filters.customTitle = { de: 'Unsere Auswahl' };
  });

  it('matches own (also internal) and ingredient tags on the server and only exposes filter ids', () => {
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const byId = new Map(items(dto).map((item) => [item.id, item.facets?.custom]));
    expect(byId.get('c1')).toEqual(['free']);
    expect(byId.get('c2')).toEqual(['fruity']);
    expect(byId.get('c3')).toEqual([]);
    expect(dto.filters.custom).toEqual([
      { id: 'free', label: 'Alkoholfrei', quick: true, count: 1 },
      { id: 'fruity', label: 'Fruchtig', quick: false, count: 1 },
    ]);
    expect(dto.filters.customTitle).toBe('Unsere Auswahl');
    expect(JSON.stringify(dto)).not.toContain('mocktail');
  });

  it('is web-only', () => {
    const { dto } = buildPublicMenuDto(buildInput(doc, { output: 'monitor' }), data);
    expect(dto.filters.custom).toEqual([]);
  });
});

describe('buildPublicMenuDto – unit labels', () => {
  const lime = { id: 'ing-lime', name: 'Limette', guestName: null, tags: [], hideOnGuestMenu: false, translations: [] };
  const data = resolverData(
    [
      cocktail({
        id: 'c1',
        steps: [
          {
            optional: false,
            ingredients: [
              { optional: false, amount: 4, unitName: 'CL', ingredient: lime },
              { optional: false, amount: 2, unitName: 'DASH', ingredient: { ...lime, id: 'ing-2' } },
              { optional: false, amount: 1, unitName: 'PIECE', ingredient: { ...lime, id: 'ing-3' } },
            ],
          },
        ],
      }),
    ],
    { labels: { de: { CL: 'cl', DASH: 'Spritzer' }, en: { CL: 'cl' } } },
  );
  const doc = manualDocument(['c1'], (d) => {
    d.outputs.web.fields = { ...d.outputs.web.fields, amounts: 'list' };
  });

  it('uses the guest language, then the primary content language, then the unit key', () => {
    const units = (locale: string) => items(buildPublicMenuDto(buildInput(doc, { locale }), data).dto)[0].amounts?.map((entry) => entry.unit);
    expect(units('de')).toEqual(['cl', 'Spritzer', 'PIECE']);
    expect(units('en')).toEqual(['cl', 'Spritzer', 'PIECE']);
  });
});
