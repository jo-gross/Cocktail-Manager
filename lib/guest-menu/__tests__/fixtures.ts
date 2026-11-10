import type { DerivedGuestInfo } from '@lib/guest-info/derive';
import type { ResolverCocktail, ResolverData, BuildPublicMenuInput } from '../resolveCore';
import { createDefaultGuestMenuDocument, type GuestMenuDocument } from '../schema';

export function cocktail(overrides: Partial<ResolverCocktail> & { id: string }): ResolverCocktail {
  return {
    name: `Cocktail ${overrides.id}`,
    description: null,
    history: null,
    tags: [],
    price: 10,
    isArchived: false,
    unavailableUntil: null,
    hasImage: false,
    glass: null,
    garnishes: [],
    steps: [],
    translations: [],
    ...overrides,
  };
}

export function guestInfo(overrides: Partial<DerivedGuestInfo> = {}): DerivedGuestInfo {
  return {
    allergens: [],
    additives: [],
    complete: true,
    alcohol: { abv: 12.34, status: 'calculated', category: 'medium', alcoholFree: false, grams: 14.2, volumeMl: 150 },
    ...overrides,
  };
}

export function resolverData(cocktails: ResolverCocktail[], overrides: Partial<ResolverData> = {}): ResolverData {
  return {
    settings: { timezone: 'Europe/Berlin', currency: 'EUR', contentLocales: { primary: 'de', additional: ['en'] } },
    sourceCard: null,
    cocktails: new Map(cocktails.map((c) => [c.id, c])),
    guestInfo: new Map(),
    tagDefinitions: [],
    tagCategories: [],
    ratings: new Map(),
    ...overrides,
  };
}

export function manualDocument(cocktailIds: string[], mutate?: (doc: GuestMenuDocument) => void): GuestMenuDocument {
  const doc = createDefaultGuestMenuDocument({ locale: 'de', title: 'Karte', withCardSection: false });
  doc.blocks.splice(1, 0, { id: 'sec1', type: 'section', title: { de: 'Drinks', en: 'Drinks EN' }, source: { kind: 'manual', cocktailIds }, overrides: {} });
  mutate?.(doc);
  return doc;
}

export function buildInput(document: GuestMenuDocument, overrides: Partial<BuildPublicMenuInput> = {}): BuildPublicMenuInput {
  return {
    workspace: { id: 'ws1', name: 'Bar', publicSlug: 'bar', hasImage: false },
    menu: { id: 'menu1', slug: 'abend', name: 'Abendkarte', locales: [], publishedAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' },
    document,
    now: new Date('2026-11-10T20:00:00Z'),
    ...overrides,
  };
}
