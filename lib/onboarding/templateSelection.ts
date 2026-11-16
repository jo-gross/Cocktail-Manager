/**
 * Client-side selection of template items for the start content picker. Mirrors the dependency
 * closure of `selectTemplateContent` (lib/templates/transform.ts): card → cocktails, cocktail →
 * glass, ingredients, garnishes. Pure module.
 */

export const TEMPLATE_ITEM_KINDS = ['glasses', 'ingredients', 'garnishes', 'cocktails', 'cards'] as const;
export type TemplateItemKind = (typeof TEMPLATE_ITEM_KINDS)[number];

export type TemplateSelectionIds = Record<TemplateItemKind, string[]>;

/** The parts of `TemplateItemsDto` the selection needs. */
export interface SelectableTemplateItems {
  glasses: Array<{ id: string; name: string }>;
  ingredients: Array<{ id: string; name: string }>;
  garnishes: Array<{ id: string; name: string }>;
  cocktails: Array<{ id: string; name: string; glassId: string | null; ingredientIds: string[]; garnishIds: string[] }>;
  cards: Array<{ id: string; name: string; cocktailIds: string[] }>;
}

export interface ResolvedTemplateSelection {
  /** Explicitly picked plus required items. */
  selected: Record<TemplateItemKind, Set<string>>;
  /** Item id → names of the selected items that need it (only for items added as dependency). */
  requiredBy: Record<TemplateItemKind, Map<string, string[]>>;
  counts: Record<TemplateItemKind, number>;
}

export function emptyTemplateSelection(): TemplateSelectionIds {
  return { glasses: [], ingredients: [], garnishes: [], cocktails: [], cards: [] };
}

function addRequirement(target: Map<string, string[]>, id: string, by: string) {
  const names = target.get(id);
  if (!names) target.set(id, [by]);
  else if (!names.includes(by)) names.push(by);
}

export function resolveTemplateSelection(items: SelectableTemplateItems, picked: TemplateSelectionIds): ResolvedTemplateSelection {
  const known = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, new Set(items[kind].map((item) => item.id))])) as Record<
    TemplateItemKind,
    Set<string>
  >;
  const explicit = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, new Set(picked[kind].filter((id) => known[kind].has(id)))])) as Record<
    TemplateItemKind,
    Set<string>
  >;
  const selected = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, new Set(explicit[kind])])) as Record<TemplateItemKind, Set<string>>;
  const requiredBy = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, new Map<string, string[]>()])) as Record<
    TemplateItemKind,
    Map<string, string[]>
  >;

  for (const card of items.cards) {
    if (!explicit.cards.has(card.id)) continue;
    for (const cocktailId of card.cocktailIds) {
      if (!known.cocktails.has(cocktailId)) continue;
      selected.cocktails.add(cocktailId);
      if (!explicit.cocktails.has(cocktailId)) addRequirement(requiredBy.cocktails, cocktailId, card.name);
    }
  }

  for (const cocktail of items.cocktails) {
    if (!selected.cocktails.has(cocktail.id)) continue;
    const dependencies: Array<[TemplateItemKind, string[]]> = [
      ['glasses', cocktail.glassId ? [cocktail.glassId] : []],
      ['ingredients', cocktail.ingredientIds],
      ['garnishes', cocktail.garnishIds],
    ];
    for (const [kind, ids] of dependencies) {
      for (const id of ids) {
        if (!known[kind].has(id)) continue;
        selected[kind].add(id);
        if (!explicit[kind].has(id)) addRequirement(requiredBy[kind], id, cocktail.name);
      }
    }
  }

  const counts = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, selected[kind].size])) as Record<TemplateItemKind, number>;
  return { selected, requiredBy, counts };
}

/** Toggles an explicit pick; required items stay selected through their dependents. */
export function toggleTemplatePick(picked: TemplateSelectionIds, kind: TemplateItemKind, id: string, checked: boolean): TemplateSelectionIds {
  const without = picked[kind].filter((entry) => entry !== id);
  return { ...picked, [kind]: checked ? [...without, id] : without };
}

/** Picks (or unpicks) all given ids of a kind, e.g. the filtered list. */
export function setTemplatePicks(picked: TemplateSelectionIds, kind: TemplateItemKind, ids: string[], checked: boolean): TemplateSelectionIds {
  const remove = new Set(ids);
  const rest = picked[kind].filter((entry) => !remove.has(entry));
  return { ...picked, [kind]: checked ? [...rest, ...ids] : rest };
}

export function totalSelected(counts: Record<TemplateItemKind, number>): number {
  return TEMPLATE_ITEM_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
}

/** Case- and accent-insensitive search. */
export function matchesSearch(name: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  const needle = normalize(query);
  return needle === '' || normalize(name).includes(needle);
}

/** Templates in the content language first; the rest are only offered if no template matches. */
export function templatesForLocale<T extends { locales: string[] }>(templates: T[], locale: string): { templates: T[]; otherLanguage: boolean } {
  const base = locale.split('-')[0];
  const matching = templates.filter((template) => template.locales.some((entry) => entry === locale || entry.split('-')[0] === base));
  return matching.length > 0 || templates.length === 0 ? { templates: matching, otherLanguage: false } : { templates, otherLanguage: true };
}
