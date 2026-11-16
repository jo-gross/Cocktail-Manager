import { describe, expect, it } from 'vitest';
import { BackupImportSchema, findBackupReferenceIssues, type BackupImportData } from '@lib/backup/backupSchema';
import {
  dropExistingCards,
  findExistingMatches,
  findUnknownSelectionIds,
  normalizeTemplateName,
  pivotTemplateLocale,
  selectTemplateContent,
} from '@lib/templates/transform';

function template(): BackupImportData {
  return BackupImportSchema.parse({
    units: [{ id: 'u-cl', name: 'CL' }],
    stepActions: [{ id: 'a-shake', name: 'SHAKE', actionGroup: 'MIXING' }],
    ice: [{ id: 'i-cubes', name: 'ICE_CUBES' }],
    glass: [
      { id: 'g-coupe', name: 'Coupette' },
      { id: 'g-tumbler', name: 'Tumbler' },
    ],
    ingredient: [
      { id: 'in-rum', name: 'Weißer Rum', description: 'Hell' },
      { id: 'in-lime', name: 'Limettensaft' },
      { id: 'in-gin', name: 'Gin' },
    ],
    ingredientVolumes: [{ ingredientId: 'in-gin', unitId: 'u-cl', volume: 70 }],
    garnish: [{ id: 'ga-wheel', name: 'Limettenrad' }],
    cocktailRecipe: [{ id: 'c-daiquiri', name: 'Daiquiri', glassId: 'g-coupe', iceId: 'i-cubes', description: 'Klassiker' }],
    cocktailRecipeStep: [{ id: 's-1', stepNumber: 0, actionId: 'a-shake', cocktailRecipeId: 'c-daiquiri' }],
    cocktailRecipeIngredient: [
      { ingredientNumber: 0, ingredientId: 'in-rum', cocktailRecipeStepId: 's-1', unitId: 'u-cl', amount: 6 },
      { ingredientNumber: 1, ingredientId: 'in-lime', cocktailRecipeStepId: 's-1', unitId: 'u-cl', amount: 2 },
    ],
    cocktailRecipeGarnish: [{ cocktailRecipeId: 'c-daiquiri', garnishId: 'ga-wheel', garnishNumber: 0 }],
    cocktailCard: [{ id: 'card-summer', name: 'Sommer' }],
    cocktailCardGroup: [{ id: 'grp-1', name: 'Sours', cocktailCardId: 'card-summer' }],
    cocktailCardGroupItem: [{ cocktailCardGroupId: 'grp-1', cocktailId: 'c-daiquiri' }],
    calculation: [{ id: 'calc', name: 'Event' }],
    calculationItems: [{ plannedAmount: 10, cocktailId: 'c-daiquiri', calculationId: 'calc' }],
    glassTranslations: [{ glassId: 'g-coupe', locale: 'en', name: 'Coupe' }],
    ingredientTranslations: [
      { ingredientId: 'in-rum', locale: 'en', name: 'White Rum', description: '' },
      { ingredientId: 'in-gin', locale: 'en', name: 'Gin' },
    ],
    cocktailRecipeTranslations: [{ cocktailId: 'c-daiquiri', locale: 'en', description: 'Classic' }],
  });
}

const ids = <T extends { id: string }>(rows: T[]) => rows.map((row) => row.id).sort();

function menu(id: string, sourceMode: 'NONE' | 'FIXED_CARD' | 'ACTIVE_CARD', sourceCardId: string | null) {
  return BackupImportSchema.parse({ guestMenus: [{ id, name: id, sourceMode, sourceCardId, draft: {} }] }).guestMenus![0]!;
}

describe('selectTemplateContent', () => {
  it('keeps everything for "all"', () => {
    const data = template();
    expect(selectTemplateContent(data, 'all')).toBe(data);
  });

  it('adds the dependencies of cards and cocktails and drops calculations', () => {
    const selected = selectTemplateContent(template(), 'selection', { cards: ['card-summer'] });
    expect(ids(selected.cocktailRecipe)).toEqual(['c-daiquiri']);
    expect(ids(selected.glass)).toEqual(['g-coupe']);
    expect(ids(selected.ingredient)).toEqual(['in-lime', 'in-rum']);
    expect(ids(selected.garnish)).toEqual(['ga-wheel']);
    expect(selected.cocktailCardGroupItem).toHaveLength(1);
    expect(selected.calculation).toEqual([]);
    expect(selected.calculationItems).toEqual([]);
    expect(selected.ingredientTranslations?.map((row) => row.ingredientId)).toEqual(['in-rum']);
    expect(selected.units).toHaveLength(1);
    expect(findBackupReferenceIssues(selected)).toEqual([]);
  });

  it('keeps guest menus built on a selected card', () => {
    const data = { ...template(), guestMenus: [menu('m-card', 'FIXED_CARD', 'card-summer'), menu('m-active', 'ACTIVE_CARD', null)] };
    expect(selectTemplateContent(data, 'selection', { cards: ['card-summer'] }).guestMenus?.map((row) => row.id)).toEqual(['m-card']);
    expect(selectTemplateContent(data, 'selection', { cocktails: ['c-daiquiri'] }).guestMenus).toEqual([]);
    expect(selectTemplateContent(data, 'basics').guestMenus).toEqual([]);
  });

  it('selects single items without cocktails', () => {
    const selected = selectTemplateContent(template(), 'selection', { ingredients: ['in-gin'] });
    expect(ids(selected.ingredient)).toEqual(['in-gin']);
    expect(selected.ingredientVolumes).toHaveLength(1);
    expect(selected.cocktailRecipe).toEqual([]);
    expect(selected.glass).toEqual([]);
  });

  it('"basics" = all glasses, ingredients and garnishes', () => {
    const selected = selectTemplateContent(template(), 'basics');
    expect(ids(selected.glass)).toEqual(['g-coupe', 'g-tumbler']);
    expect(selected.ingredient).toHaveLength(3);
    expect(selected.garnish).toHaveLength(1);
    expect(selected.cocktailRecipe).toEqual([]);
    expect(selected.cocktailCard).toEqual([]);
  });

  it('keeps only tag definitions of the kept cocktails and ingredients', () => {
    const data = BackupImportSchema.parse({
      ...template(),
      ingredient: template().ingredient.map((row) => (row.id === 'in-gin' ? { ...row, tags: ['spirit'] } : row)),
      cocktailRecipe: template().cocktailRecipe.map((row) => ({ ...row, tags: ['sour'] })),
      tagCategories: [{ id: 'cat', name: { de: 'Stil', en: 'Style' } }],
      tagDefinitions: [
        { tag: 'spirit', categoryId: 'cat' },
        { tag: 'sour', categoryId: 'cat' },
        { tag: 'unused', categoryId: 'cat' },
      ],
    });
    expect(selectTemplateContent(data, 'basics').tagDefinitions?.map((row) => row.tag)).toEqual(['spirit']);
    expect(selectTemplateContent(data, 'selection', { cocktails: ['c-daiquiri'] }).tagDefinitions?.map((row) => row.tag)).toEqual(['sour']);
    expect(selectTemplateContent(data, 'basics').tagCategories).toHaveLength(1);
    expect(selectTemplateContent(data, 'all').tagDefinitions).toHaveLength(3);
  });

  it('reports ids that are not part of the template', () => {
    expect(findUnknownSelectionIds(template(), { glasses: ['g-coupe', 'foreign'], cards: ['card-summer'] })).toEqual(['glasses:foreign']);
  });
});

describe('pivotTemplateLocale', () => {
  it('uses the target translation and keeps the original as translation', () => {
    const pivoted = pivotTemplateLocale(template(), 'de', 'en');
    const rum = pivoted.ingredient.find((row) => row.id === 'in-rum')!;
    // Empty translated fields keep the original text.
    expect(rum).toMatchObject({ name: 'White Rum', description: 'Hell' });
    expect(pivoted.ingredientTranslations).toContainEqual({ ingredientId: 'in-rum', locale: 'de', name: 'Weißer Rum', guestName: null, description: 'Hell' });
    expect(pivoted.ingredientTranslations?.some((row) => row.ingredientId === 'in-rum' && row.locale === 'en')).toBe(false);
    // Without a translation the entity stays as it is.
    expect(pivoted.ingredient.find((row) => row.id === 'in-lime')!.name).toBe('Limettensaft');
    expect(pivoted.glass.find((row) => row.id === 'g-coupe')!.name).toBe('Coupe');
    expect(pivoted.cocktailRecipe[0]).toMatchObject({ name: 'Daiquiri', description: 'Classic' });
    expect(pivoted.cocktailRecipeTranslations).toEqual([{ cocktailId: 'c-daiquiri', locale: 'de', name: 'Daiquiri', description: 'Klassiker', history: null }]);
  });

  it('is a no-op for the same language', () => {
    const data = template();
    expect(pivotTemplateLocale(data, 'de', 'de')).toBe(data);
  });
});

describe('duplicate matching', () => {
  it('normalizes case, accents and whitespace', () => {
    expect(normalizeTemplateName('  Weißer   RUM ')).toBe('weißer rum');
    expect(normalizeTemplateName('Crème de Cassis')).toBe(normalizeTemplateName('creme de cassis'));
  });

  it('links template items whose name in any language exists in the workspace (any language)', () => {
    const links = findExistingMatches(template(), {
      glasses: [{ id: 'own-glass', names: ['Martini', 'coupe'] }],
      ingredients: [{ id: 'own-rum', names: ['Rum blanco', 'WHITE RUM'] }],
      garnishes: [],
      cocktails: [{ id: 'own-daiquiri', names: ['daiquiri'] }],
    });
    expect(links.glass).toEqual(new Map([['g-coupe', 'own-glass']]));
    expect(links.ingredient).toEqual(new Map([['in-rum', 'own-rum']]));
    expect(links.garnish.size).toBe(0);
    expect(links.cocktail).toEqual(new Map([['c-daiquiri', 'own-daiquiri']]));
  });

  it('drops cards that already exist', () => {
    const { data, skipped } = dropExistingCards(template(), ['sommer']);
    expect(skipped).toBe(1);
    expect(data.cocktailCard).toEqual([]);
    expect(data.cocktailCardGroup).toEqual([]);
    expect(data.cocktailCardGroupItem).toEqual([]);
  });

  it('drops guest menus built on an existing card; other menus only lose the reference', () => {
    const data = {
      ...template(),
      guestMenus: [menu('m-card', 'FIXED_CARD', 'card-summer'), menu('m-none', 'NONE', 'card-summer'), menu('m-active', 'ACTIVE_CARD', null)],
    };
    const result = dropExistingCards(data, ['Sommer']);
    expect(result.skippedGuestMenus).toBe(1);
    expect(result.data.guestMenus?.map((row) => [row.id, row.sourceCardId])).toEqual([
      ['m-none', null],
      ['m-active', null],
    ]);
    expect(dropExistingCards(data, []).skippedGuestMenus).toBe(0);
  });
});
