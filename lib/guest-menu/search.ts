/**
 * Guest shell search & filter logic (pure, used by components/guest-menu/shell).
 *
 * Search: normalized (trim, lower case, accents stripped – like
 * lib/StringUtils `normalizeString`); every query token must match a word by
 * prefix, or (tokens ≥ 4 chars) with Levenshtein ≤ 1 against the word / word
 * prefix. Matches name, original name, ingredients and tag labels (current +
 * primary locale, see `PublicMenuItemDto.searchIndex`) and reports the reason.
 *
 * Filters: within a tag category OR, between categories AND; alcohol
 * categories OR; "without X" excludes and only matches complete items; max price;
 * custom filters (matched on the server) narrow down (AND).
 */
import levenshtein from 'js-levenshtein';
import type { AlcoholCategory, Allergen } from '@lib/guest-info/constants';
import type { PublicMenuDto, PublicMenuItemDto, PublicTagCategoryDto } from './schema';

export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export type MatchReasonKind = 'name' | 'originalName' | 'ingredient' | 'tag';

export interface MatchReason {
  kind: MatchReasonKind;
  /** The matched text (display form). */
  value: string;
}

export interface SearchEntry {
  item: PublicMenuItemDto;
  /** Section id (`null` for on-request items). */
  sectionId: string | null;
  /** Position in the menu (for stable ordering). */
  order: number;
  fields: { kind: MatchReasonKind; value: string; words: string[]; normalized: string }[];
}

function toWords(normalized: string): string[] {
  return normalized.split(/[^a-z0-9ß]+/i).filter(Boolean);
}

export function createSearchEntry(item: PublicMenuItemDto, sectionId: string | null, order: number): SearchEntry {
  const fields: SearchEntry['fields'] = [];
  const add = (kind: MatchReasonKind, value: string | null | undefined) => {
    if (!value) return;
    const normalized = normalizeSearchText(value);
    if (!normalized || fields.some((field) => field.kind === kind && field.normalized === normalized)) return;
    fields.push({ kind, value, words: toWords(normalized), normalized });
  };
  add('name', item.name);
  if (item.nameOriginal !== item.name) add('originalName', item.nameOriginal);
  const ingredientNames = item.searchIndex?.ingredients ?? item.ingredients?.map((entry) => entry.name) ?? [];
  ingredientNames.forEach((name) => add('ingredient', name));
  const tagLabels = item.searchIndex?.tags ?? item.tags?.map((tag) => tag.label) ?? [];
  tagLabels.forEach((label) => add('tag', label));
  return { item, sectionId, order, fields };
}

/** Builds entries for all section items and on-request items (deduplicated by id). */
export function buildSearchEntries(dto: PublicMenuDto): { menu: SearchEntry[]; onRequest: SearchEntry[] } {
  const menu: SearchEntry[] = [];
  let order = 0;
  for (const block of dto.blocks) {
    if (block.type !== 'section') continue;
    for (const item of block.items) menu.push(createSearchEntry(item, block.id, order++));
  }
  const onRequest = (dto.onRequestItems ?? []).map((item) => createSearchEntry(item, null, order++));
  return { menu, onRequest };
}

export function tokenize(query: string): string[] {
  return toWords(normalizeSearchText(query));
}

export function tokenMatchesWord(token: string, word: string): boolean {
  if (word.startsWith(token)) return true;
  if (token.length < 4) return false;
  if (levenshtein(token, word) <= 1) return true;
  return word.length > token.length && levenshtein(token, word.slice(0, token.length)) <= 1;
}

const REASON_PRIORITY: MatchReasonKind[] = ['name', 'originalName', 'ingredient', 'tag'];

/**
 * Returns the match reason (best field of the first token) or `null`.
 * All tokens must match (in any field). Empty query → `{ kind: 'name' }`-less `null` reason handled by caller.
 */
export function matchEntry(entry: SearchEntry, tokens: string[]): MatchReason | null {
  if (tokens.length === 0) return null;
  let reason: MatchReason | null = null;
  for (const [index, token] of tokens.entries()) {
    const matching = entry.fields.filter((field) => field.normalized.includes(token) || field.words.some((word) => tokenMatchesWord(token, word)));
    if (matching.length === 0) return null;
    if (index === 0 || reason === null) {
      const best = [...matching].sort((a, b) => REASON_PRIORITY.indexOf(a.kind) - REASON_PRIORITY.indexOf(b.kind))[0];
      reason = { kind: best.kind, value: best.value };
    }
  }
  return reason;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface ShellFilters {
  /** Selected tags (grouped by category for OR/AND logic). */
  tags: string[];
  alcohol: AlcoholCategory[];
  /** "Without X" allergens. */
  without: Allergen[];
  maxPrice: number | null;
  /** Selected custom filter ids (`dto.filters.custom`). */
  custom: string[];
}

export const EMPTY_FILTERS: ShellFilters = { tags: [], alcohol: [], without: [], maxPrice: null, custom: [] };

export function hasActiveFilters(filters: ShellFilters): boolean {
  return filters.tags.length > 0 || filters.alcohol.length > 0 || filters.without.length > 0 || filters.maxPrice != null || filters.custom.length > 0;
}

export type FilterGroup =
  { kind: 'category'; categoryId: string } | { kind: 'alcohol' } | { kind: 'without' } | { kind: 'price' } | { kind: 'custom'; id: string };

function tagsByCategory(filters: ShellFilters, categories: PublicTagCategoryDto[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const tag of filters.tags) {
    const category = categories.find((c) => c.tags.some((t) => t.tag === tag));
    const key = category?.id ?? '_';
    result.set(key, [...(result.get(key) ?? []), tag]);
  }
  return result;
}

/** Whether an item passes the filters; `skip` ignores one group (for facet counts). */
export function itemMatchesFilters(item: PublicMenuItemDto, filters: ShellFilters, categories: PublicTagCategoryDto[], skip?: FilterGroup): boolean {
  const facets = item.facets;
  for (const [categoryId, tags] of tagsByCategory(filters, categories)) {
    if (skip?.kind === 'category' && skip.categoryId === categoryId) continue;
    if (!tags.some((tag) => facets?.tags.includes(tag))) return false;
  }
  if (filters.alcohol.length > 0 && skip?.kind !== 'alcohol') {
    if (!facets?.alcoholCategory || !filters.alcohol.includes(facets.alcoholCategory)) return false;
  }
  if (filters.without.length > 0 && skip?.kind !== 'without') {
    if (!facets?.allergens) return false;
    if (filters.without.some((allergen) => facets.allergens!.includes(allergen))) return false;
  }
  if (filters.maxPrice != null && skip?.kind !== 'price') {
    if (facets?.price == null || facets.price > filters.maxPrice) return false;
  }
  for (const id of filters.custom ?? []) {
    if (skip?.kind === 'custom' && skip.id === id) continue;
    if (!facets?.custom?.includes(id)) return false;
  }
  return true;
}

/** Facet counts (category-excluded) for chips; 0 → chip disabled. */
export function countTag(entries: SearchEntry[], filters: ShellFilters, categories: PublicTagCategoryDto[], categoryId: string, tag: string): number {
  return entries.filter(
    (entry) => entry.item.facets?.tags.includes(tag) && itemMatchesFilters(entry.item, filters, categories, { kind: 'category', categoryId }),
  ).length;
}

export function countAlcohol(entries: SearchEntry[], filters: ShellFilters, categories: PublicTagCategoryDto[], category: AlcoholCategory): number {
  return entries.filter((entry) => entry.item.facets?.alcoholCategory === category && itemMatchesFilters(entry.item, filters, categories, { kind: 'alcohol' }))
    .length;
}

export function countWithout(entries: SearchEntry[], filters: ShellFilters, categories: PublicTagCategoryDto[], allergen: Allergen): number {
  const without = filters.without.includes(allergen) ? filters.without : [...filters.without, allergen];
  return entries.filter((entry) => itemMatchesFilters(entry.item, { ...filters, without }, categories)).length;
}

export function countCustom(entries: SearchEntry[], filters: ShellFilters, categories: PublicTagCategoryDto[], id: string): number {
  return entries.filter((entry) => entry.item.facets?.custom?.includes(id) && itemMatchesFilters(entry.item, filters, categories, { kind: 'custom', id }))
    .length;
}

export interface SearchResult {
  entry: SearchEntry;
  reason: MatchReason | null;
}

/** Applies search + filters; name matches first, unavailable items last. */
export function searchEntries(entries: SearchEntry[], query: string, filters: ShellFilters, categories: PublicTagCategoryDto[]): SearchResult[] {
  const tokens = tokenize(query);
  const results: SearchResult[] = [];
  for (const entry of entries) {
    if (!itemMatchesFilters(entry.item, filters, categories)) continue;
    if (tokens.length === 0) {
      results.push({ entry, reason: null });
      continue;
    }
    const reason = matchEntry(entry, tokens);
    if (reason) results.push({ entry, reason });
  }
  const rank = (result: SearchResult) => (result.entry.item.unavailable ? 10 : 0) + (result.reason ? REASON_PRIORITY.indexOf(result.reason.kind) : 0);
  return results.sort((a, b) => rank(a) - rank(b) || a.entry.order - b.entry.order);
}

/** Filter categories worth showing: ≥ 2 values. */
export function visibleTagCategories(categories: PublicTagCategoryDto[]): PublicTagCategoryDto[] {
  return categories.filter((category) => category.tags.length >= 2);
}

// ---------------------------------------------------------------------------
// URL state (`q`, `tags`, `alc`, `without`, `max`, `f`)
// ---------------------------------------------------------------------------

export interface ShellUrlState {
  query: string;
  filters: ShellFilters;
}

export function parseShellUrlState(search: string): ShellUrlState {
  const params = new URLSearchParams(search);
  const list = (key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  const max = params.get('max');
  return {
    query: params.get('q') ?? '',
    filters: {
      tags: list('tags'),
      alcohol: list('alc') as AlcoholCategory[],
      without: list('without') as Allergen[],
      maxPrice: max != null && max !== '' && Number.isFinite(Number(max)) ? Number(max) : null,
      custom: list('f'),
    },
  };
}

/** Writes the state into `search` (keeps other params such as `lang`, `preview`). */
export function serializeShellUrlState(search: string, state: ShellUrlState): string {
  const params = new URLSearchParams(search);
  const set = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key));
  set('q', state.query.trim());
  set('tags', state.filters.tags.join(','));
  set('alc', state.filters.alcohol.join(','));
  set('without', state.filters.without.join(','));
  set('max', state.filters.maxPrice != null ? String(state.filters.maxPrice) : '');
  set('f', (state.filters.custom ?? []).join(','));
  const result = params.toString();
  return result ? `?${result}` : '';
}
