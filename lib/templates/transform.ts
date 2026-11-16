/**
 * Pure transformations of a (parsed) template backup before it is imported:
 * selection with dependency closure, language pivot and duplicate matching
 * against the target workspace. See docs/plans/ONBOARDING-PLAN.md §1.
 */
import type { BackupImportData } from '@lib/backup/backupSchema';
import type { LinkedIds } from '@lib/backup/importHandler';

export type TemplateApplyMode = 'all' | 'basics' | 'selection';

export interface TemplateSelection {
  glasses?: string[];
  ingredients?: string[];
  garnishes?: string[];
  cocktails?: string[];
  cards?: string[];
}

const SELECTION_COLLECTIONS = {
  glasses: 'glass',
  ingredients: 'ingredient',
  garnishes: 'garnish',
  cocktails: 'cocktailRecipe',
  cards: 'cocktailCard',
} as const satisfies Record<keyof TemplateSelection, keyof BackupImportData>;

/** Selection ids that are not part of the template (per collection). */
export function findUnknownSelectionIds(data: BackupImportData, selection: TemplateSelection): string[] {
  const unknown: string[] = [];
  for (const [field, collection] of Object.entries(SELECTION_COLLECTIONS) as Array<
    [keyof TemplateSelection, (typeof SELECTION_COLLECTIONS)[keyof TemplateSelection]]
  >) {
    const known = new Set((data[collection] as Array<{ id: string }>).map((row) => row.id));
    for (const id of selection[field] ?? []) if (!known.has(id)) unknown.push(`${field}:${id}`);
  }
  return unknown;
}

/**
 * Reduces the template to the selected items plus everything they need: card → cocktails,
 * cocktail → glass, ingredients, garnishes (units, ice, step actions, tag metadata and settings are
 * always kept). `basics` = all glasses, ingredients and garnishes. Calculations, signage and guest
 * menus are only part of `all`.
 */
export function selectTemplateContent(data: BackupImportData, mode: TemplateApplyMode, selection: TemplateSelection = {}): BackupImportData {
  if (mode === 'all') return data;
  const picked: Required<TemplateSelection> =
    mode === 'basics'
      ? {
          glasses: data.glass.map((row) => row.id),
          ingredients: data.ingredient.map((row) => row.id),
          garnishes: data.garnish.map((row) => row.id),
          cocktails: [],
          cards: [],
        }
      : { glasses: [], ingredients: [], garnishes: [], cocktails: [], cards: [], ...selection };

  const cards = new Set(picked.cards);
  const groups = new Set(data.cocktailCardGroup.filter((group) => cards.has(group.cocktailCardId)).map((group) => group.id));
  const groupItems = data.cocktailCardGroupItem.filter((item) => groups.has(item.cocktailCardGroupId));
  const cocktails = new Set([...picked.cocktails, ...groupItems.map((item) => item.cocktailId)]);

  const steps = data.cocktailRecipeStep.filter((step) => cocktails.has(step.cocktailRecipeId));
  const stepIds = new Set(steps.map((step) => step.id));
  const recipeIngredients = data.cocktailRecipeIngredient.filter((row) => stepIds.has(row.cocktailRecipeStepId));
  const recipeGarnishes = data.cocktailRecipeGarnish.filter((row) => cocktails.has(row.cocktailRecipeId));
  const cocktailRows = data.cocktailRecipe.filter((row) => cocktails.has(row.id));

  const glasses = new Set([...picked.glasses, ...cocktailRows.flatMap((row) => (row.glassId ? [row.glassId] : []))]);
  const ingredients = new Set([...picked.ingredients, ...recipeIngredients.flatMap((row) => (row.ingredientId ? [row.ingredientId] : []))]);
  const garnishes = new Set([...picked.garnishes, ...recipeGarnishes.map((row) => row.garnishId)]);

  return {
    ...data,
    garnish: data.garnish.filter((row) => garnishes.has(row.id)),
    garnishImages: data.garnishImages.filter((row) => garnishes.has(row.garnishId)),
    ingredient: data.ingredient.filter((row) => ingredients.has(row.id)),
    ingredientVolumes: data.ingredientVolumes.filter((row) => ingredients.has(row.ingredientId)),
    ingredientImages: data.ingredientImages.filter((row) => ingredients.has(row.ingredientId)),
    glass: data.glass.filter((row) => glasses.has(row.id)),
    glassImages: data.glassImages.filter((row) => glasses.has(row.glassId)),
    cocktailRecipe: cocktailRows,
    cocktailRecipeImage: data.cocktailRecipeImage.filter((row) => cocktails.has(row.cocktailRecipeId)),
    cocktailRecipeStep: steps,
    cocktailRecipeGarnish: recipeGarnishes,
    cocktailRecipeIngredient: recipeIngredients,
    cocktailCard: data.cocktailCard.filter((row) => cards.has(row.id)),
    cocktailCardGroup: data.cocktailCardGroup.filter((row) => groups.has(row.id)),
    cocktailCardGroupItem: groupItems,
    calculation: [],
    calculationGroups: [],
    calculationItems: [],
    signage: [],
    signageSlides: [],
    cocktailRecipeTranslations: data.cocktailRecipeTranslations?.filter((row) => cocktails.has(row.cocktailId)),
    ingredientTranslations: data.ingredientTranslations?.filter((row) => ingredients.has(row.ingredientId)),
    garnishTranslations: data.garnishTranslations?.filter((row) => garnishes.has(row.garnishId)),
    glassTranslations: data.glassTranslations?.filter((row) => glasses.has(row.glassId)),
    guestMenus: [],
    guestMenuTemplates: [],
  };
}

type Translatable<E, T> = { entities: E[]; translations: T[] | undefined; entityId: (row: T) => string };

/** Swaps entity texts with their `to` translation and keeps the old texts as `from` translation. */
function pivot<E extends { id: string }, T extends { locale: string }, K extends keyof E & keyof T & string>(
  { entities, translations, entityId }: Translatable<E, T>,
  fields: K[],
  from: string,
  to: string,
  makeRow: (entity: E, texts: Pick<E, K>) => T,
): { entities: E[]; translations: T[] } {
  const rows = translations ?? [];
  const target = new Map(rows.filter((row) => row.locale === to).map((row) => [entityId(row), row]));
  const pivoted = new Set<string>();
  const nextEntities = entities.map((entity) => {
    const translation = target.get(entity.id);
    if (!translation) return entity;
    pivoted.add(entity.id);
    const next = { ...entity };
    for (const field of fields) {
      const value = translation[field] as unknown;
      if (typeof value === 'string' && value.trim() !== '') (next as Record<string, unknown>)[field] = value;
    }
    return next;
  });
  const original = new Map(entities.map((entity) => [entity.id, entity]));
  const nextRows = rows.filter((row) => !(pivoted.has(entityId(row)) && (row.locale === to || row.locale === from)));
  for (const id of pivoted) {
    const entity = original.get(id)!;
    const texts = Object.fromEntries(fields.map((field) => [field, entity[field]])) as Pick<E, K>;
    nextRows.push(makeRow(entity, texts));
  }
  return { entities: nextEntities, translations: nextRows };
}

/**
 * Changes the primary language of the template content from `from` to `to`: entities with a
 * `to` translation get its texts (empty fields keep the original) and the original texts become
 * the `from` translation. Entities without a `to` translation stay unchanged.
 */
export function pivotTemplateLocale(data: BackupImportData, from: string, to: string): BackupImportData {
  if (from === to) return data;
  const glasses = pivot({ entities: data.glass, translations: data.glassTranslations, entityId: (row) => row.glassId }, ['name'], from, to, (glass, texts) => ({
    glassId: glass.id,
    locale: from,
    name: texts.name,
  }));
  const garnishes = pivot(
    { entities: data.garnish, translations: data.garnishTranslations, entityId: (row) => row.garnishId },
    ['name', 'description'],
    from,
    to,
    (garnish, texts) => ({ garnishId: garnish.id, locale: from, ...texts }),
  );
  const ingredients = pivot(
    { entities: data.ingredient, translations: data.ingredientTranslations, entityId: (row) => row.ingredientId },
    ['name', 'guestName', 'description'],
    from,
    to,
    (ingredient, texts) => ({ ingredientId: ingredient.id, locale: from, ...texts }),
  );
  const cocktails = pivot(
    { entities: data.cocktailRecipe, translations: data.cocktailRecipeTranslations, entityId: (row) => row.cocktailId },
    ['name', 'description', 'history'],
    from,
    to,
    (cocktail, texts) => ({ cocktailId: cocktail.id, locale: from, ...texts }),
  );
  return {
    ...data,
    glass: glasses.entities,
    glassTranslations: glasses.translations,
    garnish: garnishes.entities,
    garnishTranslations: garnishes.translations,
    ingredient: ingredients.entities,
    ingredientTranslations: ingredients.translations,
    cocktailRecipe: cocktails.entities,
    cocktailRecipeTranslations: cocktails.translations,
  };
}

/** Case-, accent- and whitespace-insensitive name for duplicate matching. */
export function normalizeTemplateName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Existing record of the target workspace with its names in all languages. */
export interface ExistingNamedRecord {
  id: string;
  names: Array<string | null | undefined>;
}

export interface ExistingWorkspaceContent {
  glasses: ExistingNamedRecord[];
  ingredients: ExistingNamedRecord[];
  garnishes: ExistingNamedRecord[];
  cocktails: ExistingNamedRecord[];
}

function matchByName(
  rows: Array<{ id: string; name: string }>,
  translations: Array<{ id: string; name: string | null }>,
  existing: ExistingNamedRecord[],
): Map<string, string> {
  const byName = new Map<string, string>();
  for (const record of existing) {
    for (const name of record.names) {
      const key = normalizeTemplateName(name);
      if (key && !byName.has(key)) byName.set(key, record.id);
    }
  }
  const namesOf = new Map<string, string[]>(rows.map((row) => [row.id, [row.name]]));
  for (const row of translations) if (row.name) namesOf.get(row.id)?.push(row.name);

  const matches = new Map<string, string>();
  for (const [id, names] of namesOf) {
    const match = names.map(normalizeTemplateName).find((key) => key && byName.has(key));
    if (match) matches.set(id, byName.get(match)!);
  }
  return matches;
}

/**
 * Template records whose name (in any language) equals the name of an existing record of the target
 * workspace (in any language) → linked to the existing record instead of being created again.
 */
export function findExistingMatches(data: BackupImportData, existing: ExistingWorkspaceContent): Required<LinkedIds> {
  return {
    glass: matchByName(
      data.glass,
      (data.glassTranslations ?? []).map((row) => ({ id: row.glassId, name: row.name })),
      existing.glasses,
    ),
    ingredient: matchByName(
      data.ingredient,
      (data.ingredientTranslations ?? []).map((row) => ({ id: row.ingredientId, name: row.name })),
      existing.ingredients,
    ),
    garnish: matchByName(
      data.garnish,
      (data.garnishTranslations ?? []).map((row) => ({ id: row.garnishId, name: row.name })),
      existing.garnishes,
    ),
    cocktail: matchByName(
      data.cocktailRecipe,
      (data.cocktailRecipeTranslations ?? []).map((row) => ({ id: row.cocktailId, name: row.name })),
      existing.cocktails,
    ),
  };
}

/** Drops cards whose name already exists in the target workspace (with their groups and items). */
export function dropExistingCards(data: BackupImportData, existingCardNames: string[]): { data: BackupImportData; skipped: number } {
  const existing = new Set(existingCardNames.map(normalizeTemplateName));
  const dropped = new Set(data.cocktailCard.filter((card) => existing.has(normalizeTemplateName(card.name))).map((card) => card.id));
  if (dropped.size === 0) return { data, skipped: 0 };
  const groups = new Set(data.cocktailCardGroup.filter((group) => dropped.has(group.cocktailCardId)).map((group) => group.id));
  return {
    data: {
      ...data,
      cocktailCard: data.cocktailCard.filter((card) => !dropped.has(card.id)),
      cocktailCardGroup: data.cocktailCardGroup.filter((group) => !groups.has(group.id)),
      cocktailCardGroupItem: data.cocktailCardGroupItem.filter((item) => !groups.has(item.cocktailCardGroupId)),
      guestMenus: data.guestMenus?.map((menu) => (menu.sourceCardId && dropped.has(menu.sourceCardId) ? { ...menu, sourceCardId: null } : menu)),
    },
    skipped: dropped.size,
  };
}
