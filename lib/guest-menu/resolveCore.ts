/**
 * Pure core of the guest menu resolver: document + loaded data → `PublicMenuDto`.
 * This is the ONLY place that decides which data reaches guests (whitelist).
 * The Prisma loader lives in resolve.ts; tests call `buildPublicMenuDto` with mocked data.
 *
 * Never emitted: notes, ingredient prices/links, calculations, statistics,
 * users, non-public tags, hidden (`hideOnGuestMenu`) ingredients, archived
 * cocktails, amounts (unless `fields.amounts` ≠ off), fields set to `off`.
 */
import { ADDITIVE_NUMBERS, ALCOHOL_CATEGORIES, ALLERGEN_CODES, ALLERGENS, type AlcoholCategory, type Allergen } from '@lib/guest-info/constants';
import type { DerivedGuestInfo } from '@lib/guest-info/derive';
import { getAllContentLocales, type WorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings';
import { resolveLocalizedText, type LocalizedText } from './localizedText';
import {
  FIELD_KEYS,
  isBlockVisibleInOutput,
  resolveFieldConfig,
  type FieldConfig,
  type GuestMenuDocument,
  type GuestMenuOutput,
  type ItemOverride,
  type PartialFieldConfig,
  type PublicAdditiveDto,
  type PublicAllergenDto,
  type PublicBadgeDto,
  type PublicBlockDto,
  type PublicCustomFilterDto,
  type PublicMenuDto,
  type PublicMenuItemDto,
  type PublicNoticeDto,
  type PublicSectionDto,
  type PublicTagCategoryDto,
  type PublicTagDto,
  type SectionBlock,
  resolveLayoutForOutput,
} from './schema';
import { resolveLabel, type LabelCatalog } from '@lib/i18n/labelFallback';
import { themeToCssVariables } from './theme';
import { formatMoney } from './format';
import { toGuestUiLocale, translateGuestText, type GuestUiLocale } from './render/uiTexts';

// ---------------------------------------------------------------------------
// Input data shapes (what the loader selects – nothing more)
// ---------------------------------------------------------------------------

export interface ResolverWorkspace {
  id: string;
  name: string;
  publicSlug: string | null;
  /** Whether the workspace has a logo image (`Workspace.image`). */
  hasImage: boolean;
}

export interface ResolverMenu {
  id: string;
  slug: string;
  name: string;
  locales: string[];
  publishedAt: Date | string | null;
  updatedAt: Date | string;
}

type Translation<T> = { locale: string } & T;

export interface ResolverIngredient {
  id: string;
  name: string;
  guestName: string | null;
  tags: string[];
  hideOnGuestMenu: boolean;
  translations: Translation<{ name: string | null; guestName: string | null }>[];
}

export interface ResolverCocktail {
  id: string;
  name: string;
  description: string | null;
  history: string | null;
  tags: string[];
  price: number | null;
  isArchived: boolean;
  unavailableUntil: Date | string | null;
  hasImage: boolean;
  glass: { id: string; name: string; translations: Translation<{ name: string | null }>[] } | null;
  garnishes: { optional: boolean; isAlternative: boolean; garnish: { id: string; name: string; translations: Translation<{ name: string | null }>[] } }[];
  steps: {
    optional: boolean;
    ingredients: { optional: boolean; amount: number | null; unitName: string | null; ingredient: ResolverIngredient | null }[];
  }[];
  translations: Translation<{ name: string | null; description: string | null; history: string | null }>[];
}

export interface ResolverCard {
  id: string;
  name: string;
  groups: {
    id: string;
    name: string;
    groupNumber: number;
    groupPrice: number | null;
    items: { cocktailId: string; itemNumber: number; specialPrice: number | null }[];
  }[];
}

export interface ResolverTagDefinition {
  tag: string;
  label: LocalizedText | null;
  categoryId: string | null;
  color: string | null;
  isPublic: boolean;
}

export interface ResolverTagCategory {
  id: string;
  name: LocalizedText;
  order: number;
  showAsGuestFilter: boolean;
}

export interface ResolverData {
  settings: WorkspaceLocaleSettings;
  sourceCard: ResolverCard | null;
  /** Cocktails by id (at least all referenced; all non-archived if rule sections / on-request are used). */
  cocktails: ReadonlyMap<string, ResolverCocktail>;
  guestInfo: ReadonlyMap<string, DerivedGuestInfo>;
  tagDefinitions: ResolverTagDefinition[];
  tagCategories: ResolverTagCategory[];
  ratings: ReadonlyMap<string, { average: number; count: number }>;
  /** Workspace label catalog (display names of units etc., `translations` setting). */
  labels?: LabelCatalog;
}

export interface ImageUrlBuilder {
  cocktail(cocktailId: string): string;
  workspaceLogo(): string;
  /** `assetKey`: `logo`, `background` or `block-<blockId>`. */
  menuAsset(assetKey: string): string;
}

export interface BuildPublicMenuInput {
  workspace: ResolverWorkspace;
  menu: ResolverMenu;
  document: GuestMenuDocument;
  output?: GuestMenuOutput;
  /** Requested content locale (validated against the available locales). */
  locale?: string | null;
  /** Fallback preferences (e.g. Accept-Language) used when `locale` is not set. */
  preferredLocales?: string[];
  now?: Date;
  isPreview?: boolean;
  /** Defaults to the public image endpoint (`/api/public/images/{bar}/…`). */
  imageUrls?: ImageUrlBuilder;
  /** Appended to default image URLs (`?preview=<token>`) for draft previews. */
  previewToken?: string | null;
  /** Appended to default image URLs (`?access=<token>`) for protected menus on signage. */
  accessToken?: string | null;
}

/** Images referenced by a resolved menu (used by the public image endpoint allowlist). */
export interface ResolvedMenuMeta {
  cocktailImageIds: string[];
  menuAssets: string[];
  workspaceLogo: boolean;
  /** All cocktails shown (sections + on request). */
  cocktailIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getBarSlug(workspace: Pick<ResolverWorkspace, 'id' | 'publicSlug'>): string {
  return workspace.publicSlug || workspace.id;
}

export function createPublicImageUrls(
  workspace: Pick<ResolverWorkspace, 'id' | 'publicSlug'>,
  menuId: string,
  previewToken?: string | null,
  accessToken?: string | null,
): ImageUrlBuilder {
  const base = `/api/public/images/${encodeURIComponent(getBarSlug(workspace))}`;
  const params = [previewToken ? `preview=${encodeURIComponent(previewToken)}` : null, accessToken ? `access=${encodeURIComponent(accessToken)}` : null].filter(
    Boolean,
  );
  const suffix = params.length ? `?${params.join('&')}` : '';
  return {
    cocktail: (id) => `${base}/cocktail/${encodeURIComponent(id)}${suffix}`,
    workspaceLogo: () => `${base}/workspace-logo/${encodeURIComponent(workspace.id)}${suffix}`,
    menuAsset: (assetKey) => `${base}/menu-asset/${encodeURIComponent(`${menuId}~${assetKey}`)}${suffix}`,
  };
}

/** Picks a content locale: exact → base language → primary. */
export function pickContentLocale(requested: string | null | undefined, available: string[], primary: string): string {
  if (requested) {
    if (available.includes(requested)) return requested;
    const base = requested.split('-')[0];
    const match = available.find((locale) => locale === base || locale.split('-')[0] === base);
    if (match) return match;
  }
  return primary;
}

function localize<T>(translations: Translation<T>[] | undefined, locale: string, primary: string, pick: (t: T) => string | null | undefined): string | null {
  if (!translations || locale === primary) return null;
  for (const candidate of [locale, locale.split('-')[0]]) {
    const row = translations.find((t) => t.locale === candidate);
    const value = row ? pick(row) : null;
    if (value && value.trim() !== '') return value;
  }
  return null;
}

function nonEmpty(value: string | null | undefined): string | null {
  return value && value.trim() !== '' ? value : null;
}

function isTruthyMode(mode: string | undefined): boolean {
  return mode !== undefined && mode !== 'off';
}

/** Monitor and print have no detail view: `detail` → off, `expandable` → list. */
export function normalizeFieldsForOutput(fields: FieldConfig, output: GuestMenuOutput): FieldConfig {
  if (output === 'web') return fields;
  const result = { ...fields };
  for (const key of FIELD_KEYS) {
    if (result[key] === 'detail') result[key] = 'off';
    else if (result[key] === 'expandable') result[key] = 'list';
  }
  return result;
}

function sameFields(a: FieldConfig, b: FieldConfig): boolean {
  return (Object.keys(a) as (keyof FieldConfig)[]).every((key) => a[key] === b[key]);
}

function isDataImage(value: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(value);
}

/** Same-origin relative path – same rule as `SAFE_RELATIVE_URL` in ./render/urlPolicy (no `//`, `/\`, whitespace, quotes, parens). */
function isRelativeUrl(value: string): boolean {
  return /^\/(?![/\\])[^\\\s"'()]*$/.test(value);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface ItemSource {
  cocktail: ResolverCocktail;
  /** Card prices (group price / special price) if the cocktail is on the source card. */
  groupPrice: number | null;
  specialPrice: number | null;
}

export function buildPublicMenuDto(input: BuildPublicMenuInput, data: ResolverData): { dto: PublicMenuDto; meta: ResolvedMenuMeta } {
  const { workspace, menu, document } = input;
  const output: GuestMenuOutput = input.output ?? 'web';
  const now = input.now ?? new Date();
  const primary = data.settings.contentLocales.primary;
  const workspaceLocales = getAllContentLocales(data.settings.contentLocales);
  const availableLocales = menu.locales.length > 0 ? [primary, ...menu.locales.filter((l) => l !== primary)] : workspaceLocales;

  let requestedLocale = input.locale ?? null;
  if (!requestedLocale && input.preferredLocales?.length) {
    requestedLocale = input.preferredLocales.find((candidate) => pickContentLocale(candidate, availableLocales, '') !== '') ?? null;
  }
  if (!requestedLocale && output === 'print') requestedLocale = document.outputs.print.locale ?? null;
  if (!requestedLocale && output === 'monitor' && document.outputs.monitor.localeMode === 'fixed') requestedLocale = document.outputs.monitor.locale ?? null;
  const locale = pickContentLocale(requestedLocale, availableLocales, primary);
  const uiLocale: GuestUiLocale = toGuestUiLocale(locale);
  const currency = data.settings.currency;
  const imageUrls = input.imageUrls ?? createPublicImageUrls(workspace, menu.id, input.previewToken, input.accessToken);

  const text = (value: LocalizedText | null | undefined, fallback = '') => resolveLocalizedText(value, locale, primary, fallback);
  const uiTexts: Record<string, string> = {};
  for (const [key, value] of Object.entries(document.uiTexts ?? {})) {
    const resolved = text(value);
    if (resolved) uiTexts[key] = resolved;
  }
  const t = (key: string, values?: Record<string, unknown>) => translateGuestText(key, uiLocale, values, uiTexts);

  const meta: ResolvedMenuMeta = { cocktailImageIds: [], menuAssets: [], workspaceLogo: false, cocktailIds: [] };
  const imageIds = new Set<string>();
  const shownIds = new Set<string>();

  // Tags -------------------------------------------------------------------
  const tagDefinitions = new Map(data.tagDefinitions.map((definition) => [definition.tag, definition]));
  const isPublicTag = (tag: string) => tagDefinitions.get(tag)?.isPublic ?? true;
  const tagDto = (tag: string): PublicTagDto => {
    const definition = tagDefinitions.get(tag);
    return { tag, label: text(definition?.label ?? null, tag), categoryId: definition?.categoryId ?? null, color: definition?.color ?? null };
  };
  const tagLabelPrimary = (tag: string) => resolveLocalizedText(tagDefinitions.get(tag)?.label ?? null, primary, primary, tag);

  const webOutput = document.outputs.web;
  const isWeb = output === 'web';
  const offeredCategoryIds = new Set(
    webOutput.filters.categories === 'auto' ? data.tagCategories.filter((c) => c.showAsGuestFilter).map((c) => c.id) : webOutput.filters.categories,
  );
  const normalizeTag = (tag: string) => tag.trim().toLowerCase();
  // Custom filters match on the server, so internal (non-public) tags may be used without exposing them.
  const customFilters = (webOutput.filters.custom ?? [])
    .map((filter) => ({ ...filter, tagSet: new Set(filter.tags.map(normalizeTag).filter(Boolean)) }))
    .filter((filter) => filter.tagSet.size > 0);
  const matchingCustomFilters = (cocktail: ResolverCocktail): string[] => {
    if (customFilters.length === 0) return [];
    const tags = new Set(cocktail.tags.map(normalizeTag));
    for (const step of cocktail.steps) for (const row of step.ingredients) row.ingredient?.tags.forEach((tag) => tags.add(normalizeTag(tag)));
    return customFilters.filter((filter) => [...filter.tagSet].some((tag) => tags.has(tag))).map((filter) => filter.id);
  };

  // Price -------------------------------------------------------------------
  const effectivePrice = (source: ItemSource, override: ItemOverride | undefined): number | null => {
    let price = source.cocktail.price ?? null;
    if (source.groupPrice != null) price = source.groupPrice;
    if (source.specialPrice != null) price = source.specialPrice;
    if (override && override.price !== undefined) price = override.price ?? null;
    return price;
  };

  // Footnote tracking --------------------------------------------------------
  const usedFootnoteAllergens = new Set<Allergen>();
  const usedAdditives = new Map<string, PublicAdditiveDto>();
  let anyApproxAlcohol = false;

  const cardPrices = new Map<string, { groupPrice: number | null; specialPrice: number | null }>();
  for (const group of data.sourceCard?.groups ?? []) {
    for (const item of group.items) {
      if (!cardPrices.has(item.cocktailId)) cardPrices.set(item.cocktailId, { groupPrice: group.groupPrice, specialPrice: item.specialPrice });
    }
  }
  const sourceFor = (cocktail: ResolverCocktail): ItemSource => ({ cocktail, ...(cardPrices.get(cocktail.id) ?? { groupPrice: null, specialPrice: null }) });

  // Item ---------------------------------------------------------------------
  const buildItem = (
    source: ItemSource,
    fields: FieldConfig,
    override: ItemOverride | undefined,
    onRequest: boolean,
    sectionFields: FieldConfig,
  ): PublicMenuItemDto => {
    const { cocktail } = source;
    const info = data.guestInfo.get(cocktail.id);
    const nameOriginal = cocktail.name;
    const name = localize(cocktail.translations, locale, primary, (row) => row.name) ?? nameOriginal;
    const price = isTruthyMode(fields.price) ? effectivePrice(source, override) : null;
    const unavailable = cocktail.unavailableUntil != null && new Date(cocktail.unavailableUntil).getTime() > now.getTime();
    const highlight = override?.highlight ?? null;

    const item: PublicMenuItemDto = {
      id: cocktail.id,
      name,
      nameOriginal,
      price,
      priceFormatted: price != null ? formatMoney(price, locale, currency) : null,
      unavailable,
      onRequest,
      highlight: onRequest ? null : highlight,
    };

    // Ingredients (guest-visible only).
    const ingredientRows: { ingredient: ResolverIngredient; optional: boolean; amount: number | null; unitName: string | null }[] = [];
    const seenIngredients = new Set<string>();
    for (const step of cocktail.steps) {
      for (const row of step.ingredients) {
        if (!row.ingredient || row.ingredient.hideOnGuestMenu) continue;
        if (seenIngredients.has(row.ingredient.id)) continue;
        seenIngredients.add(row.ingredient.id);
        ingredientRows.push({ ingredient: row.ingredient, optional: step.optional || row.optional, amount: row.amount, unitName: row.unitName });
      }
    }
    const ingredientName = (ingredient: ResolverIngredient, targetLocale: string) =>
      localize(ingredient.translations, targetLocale, primary, (row) => nonEmpty(row.guestName) ?? row.name) ??
      nonEmpty(ingredient.guestName) ??
      ingredient.name;

    if (isTruthyMode(fields.ingredients)) {
      item.ingredients = ingredientRows.map((row) => ({ name: ingredientName(row.ingredient, locale), optional: row.optional }));
    }
    if (isTruthyMode(fields.amounts)) {
      item.amounts = ingredientRows.map((row) => ({
        name: ingredientName(row.ingredient, locale),
        amount: row.amount,
        // Unit display name in the guest's language (content-language fallback), raw unit key as last resort.
        unit: row.unitName ? resolveLabel(data.labels, row.unitName, locale, data.settings.contentLocales) : null,
        optional: row.optional,
      }));
    }

    const ownTags = cocktail.tags.filter(isPublicTag);
    if (isTruthyMode(fields.flavors)) item.tags = ownTags.map(tagDto);

    const badges: PublicBadgeDto[] = [];
    if (isTruthyMode(fields.badges) && item.highlight) badges.push({ kind: 'highlight', key: item.highlight, label: t(`badge.${item.highlight}`) });
    if (isTruthyMode(fields.badges) && isTruthyMode(fields.alcohol) && info?.alcohol.alcoholFree)
      badges.push({ kind: 'alcoholFree', key: 'alcoholFree', label: t('badge.alcoholFree') });
    if (unavailable) badges.push({ kind: 'unavailable', key: 'unavailable', label: t('badge.unavailable') });
    if (onRequest) badges.push({ kind: 'onRequest', key: 'onRequest', label: t('badge.onRequest') });
    item.badges = badges;

    if (isTruthyMode(fields.image)) {
      item.imageUrl = cocktail.hasImage ? imageUrls.cocktail(cocktail.id) : null;
      if (cocktail.hasImage) imageIds.add(cocktail.id);
    }
    if (isTruthyMode(fields.description)) {
      const description = override?.description ? text(override.description) : null;
      item.description = nonEmpty(description) ?? localize(cocktail.translations, locale, primary, (row) => row.description) ?? nonEmpty(cocktail.description);
    }
    if (isTruthyMode(fields.history)) {
      item.history = localize(cocktail.translations, locale, primary, (row) => row.history) ?? nonEmpty(cocktail.history);
    }
    if (isTruthyMode(fields.glass)) {
      item.glass = cocktail.glass ? { name: localize(cocktail.glass.translations, locale, primary, (row) => row.name) ?? cocktail.glass.name } : null;
    }
    if (isTruthyMode(fields.garnish)) {
      item.garnishes = cocktail.garnishes.map((entry) => ({
        name: localize(entry.garnish.translations, locale, primary, (row) => row.name) ?? entry.garnish.name,
        optional: entry.optional || entry.isAlternative,
      }));
    }
    if (isTruthyMode(fields.rating)) item.rating = data.ratings.get(cocktail.id) ?? null;

    if (info && isTruthyMode(fields.alcohol)) {
      const approximate = info.alcohol.status === 'calculated';
      item.alcohol = {
        abv: info.alcohol.abv != null ? Math.round(info.alcohol.abv * 10) / 10 : null,
        grams: info.alcohol.grams != null ? Math.round(info.alcohol.grams) : null,
        status: info.alcohol.status,
        category: info.alcohol.category,
        alcoholFree: info.alcohol.alcoholFree,
        approximate,
      };
      if (approximate && info.alcohol.abv != null && (fields.alcoholDisplay === 'percent' || fields.alcoholDisplay === 'percentAndGrams'))
        anyApproxAlcohol = true;
    }
    if (info && isTruthyMode(fields.allergens)) {
      item.allergens = info.allergens.map((entry): PublicAllergenDto => ({
        code: entry.code,
        short: ALLERGEN_CODES[entry.code],
        label: t(`guestInfo:allergen.${entry.code}`),
        optional: entry.optional,
      }));
      if (fields.allergenDisplay !== 'icons') info.allergens.forEach((entry) => usedFootnoteAllergens.add(entry.code));
    }
    if (info && isTruthyMode(fields.additives)) {
      item.additives = info.additives.map((entry): PublicAdditiveDto => {
        const dto = { code: entry.code, number: ADDITIVE_NUMBERS[entry.code], label: t(`guestInfo:additive.${entry.code}`), optional: entry.optional };
        usedAdditives.set(entry.code, { ...dto, optional: false });
        return dto;
      });
    }
    if (info && (isTruthyMode(fields.allergens) || isTruthyMode(fields.additives))) item.guestInfoComplete = info.complete;
    if (!sameFields(fields, sectionFields)) item.fields = fields;

    if (isWeb) {
      const inheritedTags = new Set<string>(ownTags);
      for (const row of ingredientRows) row.ingredient.tags.filter(isPublicTag).forEach((tag) => inheritedTags.add(tag));
      item.facets = {
        tags: [...inheritedTags].filter((tag) => {
          const categoryId = tagDefinitions.get(tag)?.categoryId;
          return categoryId != null && offeredCategoryIds.has(categoryId);
        }),
        alcoholCategory: webOutput.filters.alcohol ? (info?.alcohol.category ?? null) : null,
        allergens: webOutput.filters.allergens && info?.complete ? info.allergens.map((entry) => entry.code) : null,
        // Only when the price is shown – hidden prices must not leak via the filter data.
        price,
        custom: matchingCustomFilters(cocktail),
      };
      const ingredientTerms = new Set<string>();
      if (webOutput.search.ingredientsSearchable) {
        for (const row of ingredientRows) {
          ingredientTerms.add(ingredientName(row.ingredient, locale));
          ingredientTerms.add(ingredientName(row.ingredient, primary));
        }
      }
      const tagTerms = new Set<string>();
      for (const tag of inheritedTags) {
        tagTerms.add(tagDto(tag).label);
        tagTerms.add(tagLabelPrimary(tag));
      }
      item.searchIndex = { ingredients: [...ingredientTerms], tags: [...tagTerms] };
    }

    shownIds.add(cocktail.id);
    return item;
  };

  // Sections -----------------------------------------------------------------
  const outputLayout = resolveLayoutForOutput(document.outputs[output].layout, output);
  const sortItems = (items: PublicMenuItemDto[]): PublicMenuItemDto[] => {
    let sorted = items;
    if (isWeb && webOutput.sort === 'name') sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, locale));
    if (isWeb && webOutput.sort === 'price') sorted = [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    // Unavailable ("heute aus") to the end, stable.
    return [...sorted.filter((item) => !item.unavailable), ...sorted.filter((item) => item.unavailable)];
  };

  const sectionsFor = (block: SectionBlock): { id: string; title: string; sources: ItemSource[] }[] => {
    const blockTitle = text(block.title);
    const source = block.source;
    switch (source.kind) {
      case 'cardAllGroups':
        return [...(data.sourceCard?.groups ?? [])]
          .sort((a, b) => a.groupNumber - b.groupNumber)
          .map((group) => ({
            id: `${block.id}:${group.id}`,
            title: group.name,
            sources: [...group.items]
              .sort((a, b) => a.itemNumber - b.itemNumber)
              .flatMap((entry) => {
                const cocktail = data.cocktails.get(entry.cocktailId);
                return cocktail ? [{ cocktail, groupPrice: group.groupPrice, specialPrice: entry.specialPrice }] : [];
              }),
          }));
      case 'cardGroup': {
        const group = data.sourceCard?.groups.find((g) => g.id === source.groupId);
        if (!group) return [];
        return [
          {
            id: block.id,
            title: blockTitle || group.name,
            sources: [...group.items]
              .sort((a, b) => a.itemNumber - b.itemNumber)
              .flatMap((entry) => {
                const cocktail = data.cocktails.get(entry.cocktailId);
                return cocktail ? [{ cocktail, groupPrice: group.groupPrice, specialPrice: entry.specialPrice }] : [];
              }),
          },
        ];
      }
      case 'manual':
        return [
          {
            id: block.id,
            title: blockTitle,
            sources: source.cocktailIds.flatMap((id) => {
              const cocktail = data.cocktails.get(id);
              return cocktail ? [sourceFor(cocktail)] : [];
            }),
          },
        ];
      case 'rule': {
        if (source.tags.length === 0 && source.ingredientIds.length === 0) return [{ id: block.id, title: blockTitle, sources: [] }];
        const matches = [...data.cocktails.values()].filter((cocktail) => {
          const ingredientIds = new Set(cocktail.steps.flatMap((step) => step.ingredients.map((row) => row.ingredient?.id).filter((id): id is string => !!id)));
          const checks = [...source.tags.map((tag) => cocktail.tags.includes(tag)), ...source.ingredientIds.map((id) => ingredientIds.has(id))];
          return source.logic === 'AND' ? checks.every(Boolean) : checks.some(Boolean);
        });
        const sources = matches.map(sourceFor);
        if (source.sort === 'price')
          sources.sort(
            (a, b) => (effectivePrice(a, block.overrides[a.cocktail.id]) ?? Infinity) - (effectivePrice(b, block.overrides[b.cocktail.id]) ?? Infinity),
          );
        else sources.sort((a, b) => a.cocktail.name.localeCompare(b.cocktail.name, primary));
        return [{ id: block.id, title: blockTitle, sources }];
      }
    }
  };

  const blocks: PublicBlockDto[] = [];
  const hiddenIds = new Set<string>();
  const outputFields = normalizeFieldsForOutput(resolveFieldConfig(document, output), output);

  for (const block of document.blocks) {
    if (!isBlockVisibleInOutput(block, output)) continue;
    switch (block.type) {
      case 'header':
        blocks.push({ id: block.id, type: 'header', showLogo: block.showLogo, showTitle: block.showTitle, showSubtitle: block.showSubtitle });
        break;
      case 'section': {
        const sectionFields = normalizeFieldsForOutput(resolveFieldConfig(document, output, block.fields), output);
        for (const expanded of sectionsFor(block)) {
          const seen = new Set<string>();
          const items: PublicMenuItemDto[] = [];
          for (const source of expanded.sources) {
            const cocktail = source.cocktail;
            if (cocktail.isArchived || seen.has(cocktail.id)) continue;
            const override = block.overrides[cocktail.id];
            if (override?.hidden) {
              hiddenIds.add(cocktail.id);
              continue;
            }
            seen.add(cocktail.id);
            const fields = override?.fields
              ? normalizeFieldsForOutput(resolveFieldConfig(document, output, block.fields, override.fields as PartialFieldConfig), output)
              : sectionFields;
            items.push(buildItem(source, fields, override, false, sectionFields));
          }
          if (items.length === 0) continue;
          const section: PublicSectionDto = {
            id: expanded.id,
            sourceBlockId: block.id,
            title: expanded.title,
            description: block.description ? nonEmpty(text(block.description)) : null,
            layout: block.layout ? resolveLayoutForOutput(block.layout, output) : outputLayout,
            fields: sectionFields,
            items: sortItems(items),
          };
          blocks.push({ type: 'section', ...section });
        }
        break;
      }
      case 'text': {
        const markdown = text(block.content);
        if (markdown) blocks.push({ id: block.id, type: 'text', markdown });
        break;
      }
      case 'image': {
        let src: string | null = null;
        if (isDataImage(block.src)) {
          const key = `block-${block.id}`;
          src = imageUrls.menuAsset(key);
          meta.menuAssets.push(key);
        } else if (isRelativeUrl(block.src)) {
          src = block.src;
        }
        if (src) blocks.push({ id: block.id, type: 'image', src, alt: text(block.alt ?? null) });
        break;
      }
      case 'divider':
        blocks.push({ id: block.id, type: 'divider' });
        break;
      case 'notice': {
        let markdown = text(block.text ?? null);
        if (!markdown && block.preset !== 'custom') markdown = text(document.noticeTexts?.[block.preset] ?? null) || t(`notice.${block.preset}`);
        if (markdown) blocks.push({ id: block.id, type: 'notice', preset: block.preset, markdown });
        break;
      }
    }
  }

  // On request (web search) -------------------------------------------------------
  let onRequestItems: PublicMenuItemDto[] | undefined;
  if (isWeb && webOutput.search.enabled && webOutput.search.includeOnRequest) {
    onRequestItems = [...data.cocktails.values()]
      .filter((cocktail) => !cocktail.isArchived && !shownIds.has(cocktail.id) && !hiddenIds.has(cocktail.id))
      .sort((a, b) => a.name.localeCompare(b.name, primary))
      .map((cocktail) => buildItem(sourceFor(cocktail), outputFields, undefined, true, outputFields));
  }

  // Filters -----------------------------------------------------------------
  const sectionItems = blocks.flatMap((block) => (block.type === 'section' ? block.items : []));
  const uniqueItems = [...new Map(sectionItems.map((item) => [item.id, item])).values()];
  const tagCounts = new Map<string, number>();
  for (const item of uniqueItems) for (const tag of item.facets?.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  const tagCategories: PublicTagCategoryDto[] = isWeb
    ? data.tagCategories
        .filter((category) => offeredCategoryIds.has(category.id))
        .sort((a, b) => a.order - b.order)
        .map((category) => ({
          id: category.id,
          name: text(category.name, category.id),
          order: category.order,
          tags: [...tagCounts.entries()]
            .filter(([tag]) => tagDefinitions.get(tag)?.categoryId === category.id)
            .map(([tag, count]) => ({ ...tagDto(tag), count }))
            .sort((a, b) => a.label.localeCompare(b.label, locale)),
        }))
        .filter((category) => category.tags.length > 0)
    : [];

  const customFilterDtos: PublicCustomFilterDto[] = isWeb
    ? customFilters
        .map((filter) => ({
          id: filter.id,
          label: text(filter.label, filter.id),
          quick: filter.quick !== false,
          count: uniqueItems.filter((item) => item.facets?.custom?.includes(filter.id)).length,
        }))
        .filter((filter) => filter.count > 0)
    : [];

  const allergenSet = new Set<Allergen>();
  const alcoholSet = new Set<AlcoholCategory>();
  for (const item of uniqueItems) {
    item.facets?.allergens?.forEach((code) => allergenSet.add(code));
    if (item.facets?.alcoholCategory) alcoholSet.add(item.facets.alcoholCategory);
  }

  // Notices & footnotes ----------------------------------------------------------
  const notices: PublicNoticeDto[] = [];
  if (anyApproxAlcohol) notices.push({ key: 'alcoholApprox', markdown: text(document.noticeTexts?.alcoholApprox ?? null) || t('notice.alcoholApprox') });
  if (sectionItems.some((item) => item.unavailable) && document.noticeTexts?.unavailable)
    notices.push({ key: 'unavailable', markdown: text(document.noticeTexts.unavailable) });
  if (onRequestItems && onRequestItems.length > 0 && document.noticeTexts?.onRequest)
    notices.push({ key: 'onRequest', markdown: text(document.noticeTexts.onRequest) });

  const footnoteAllergens: PublicAllergenDto[] = ALLERGENS.filter((code) => usedFootnoteAllergens.has(code)).map((code) => ({
    code,
    short: ALLERGEN_CODES[code],
    label: t(`guestInfo:allergen.${code}`),
    optional: false,
  }));
  const footnoteAdditives = [...usedAdditives.values()].sort((a, b) => a.number - b.number);

  // Theme ------------------------------------------------------------------
  const theme = document.theme;
  let logoUrl: string | null = null;
  if (theme.logo && isDataImage(theme.logo)) {
    logoUrl = imageUrls.menuAsset('logo');
    meta.menuAssets.push('logo');
  } else if (theme.logo && isRelativeUrl(theme.logo)) {
    logoUrl = theme.logo;
  } else if (!theme.logo && workspace.hasImage) {
    logoUrl = imageUrls.workspaceLogo();
    meta.workspaceLogo = true;
  }
  let backgroundImageUrl: string | null = null;
  if (theme.backgroundImage && isDataImage(theme.backgroundImage)) {
    backgroundImageUrl = imageUrls.menuAsset('background');
    meta.menuAssets.push('background');
  } else if (theme.backgroundImage && isRelativeUrl(theme.backgroundImage)) {
    backgroundImageUrl = theme.backgroundImage;
  }

  meta.cocktailImageIds = [...imageIds];
  meta.cocktailIds = [...shownIds];

  const toIso = (value: Date | string | null) => (value == null ? null : new Date(value).toISOString());
  const dto: PublicMenuDto = {
    menu: {
      id: menu.id,
      slug: menu.slug,
      name: menu.name,
      title: text(document.title, menu.name),
      subtitle: nonEmpty(text(document.subtitle ?? null)),
      workspaceName: workspace.name,
      workspaceSlug: workspace.publicSlug,
      publishedAt: toIso(menu.publishedAt),
      updatedAt: toIso(menu.updatedAt) ?? new Date(0).toISOString(),
      isPreview: input.isPreview ?? false,
      publicPath: `/m/${encodeURIComponent(getBarSlug(workspace))}/${encodeURIComponent(menu.slug)}`,
    },
    output,
    locale,
    primaryLocale: primary,
    availableLocales,
    uiLocale,
    currency,
    theme: { preset: theme.preset, tokens: theme.tokens, cssVariables: themeToCssVariables(theme.tokens), backgroundImageUrl, logoUrl },
    layout: outputLayout,
    fields: outputFields,
    blocks,
    search: isWeb ? webOutput.search : undefined,
    filters: {
      tagCategories,
      custom: customFilterDtos,
      customTitle: isWeb && webOutput.filters.customTitle ? nonEmpty(text(webOutput.filters.customTitle)) : null,
      allergens: isWeb && webOutput.filters.allergens ? ALLERGENS.filter((code) => allergenSet.has(code)) : [],
      alcoholCategories: isWeb && webOutput.filters.alcohol ? ALCOHOL_CATEGORIES.filter((category) => alcoholSet.has(category)) : [],
    },
    footnotes: { allergens: footnoteAllergens, additives: footnoteAdditives },
    notices,
    uiTexts,
    ...(onRequestItems ? { onRequestItems } : {}),
    ...(isWeb ? { noindex: !!webOutput.noindex } : {}),
    ...(output === 'monitor'
      ? {
          monitor: {
            columns: document.outputs.monitor.columns,
            pageDurationSeconds: document.outputs.monitor.pageDurationSeconds,
            showQrCode: document.outputs.monitor.showQrCode,
            localeMode: document.outputs.monitor.localeMode,
          },
        }
      : {}),
  };
  return { dto, meta };
}

/** Which data the document needs (lets the loader skip work). */
export function analyzeDocumentNeeds(document: GuestMenuDocument, output: GuestMenuOutput) {
  const visibleSections = document.blocks.filter((block): block is SectionBlock => block.type === 'section' && isBlockVisibleInOutput(block, output));
  const fieldsInUse = (key: keyof FieldConfig) =>
    visibleSections.some((section) => {
      if (isTruthyMode(resolveFieldConfig(document, output, section.fields)[key] as string)) return true;
      return Object.values(section.overrides).some(
        (override) => override.fields && isTruthyMode(resolveFieldConfig(document, output, section.fields, override.fields)[key] as string),
      );
    }) || isTruthyMode(resolveFieldConfig(document, output)[key] as string);
  const web = output === 'web';
  const onRequest = web && document.outputs.web.search.enabled && document.outputs.web.search.includeOnRequest;
  return {
    needsCard: visibleSections.some((section) => section.source.kind === 'cardAllGroups' || section.source.kind === 'cardGroup'),
    needsAllCocktails: onRequest || visibleSections.some((section) => section.source.kind === 'rule'),
    manualCocktailIds: visibleSections.flatMap((section) => (section.source.kind === 'manual' ? section.source.cocktailIds : [])),
    needsGuestInfo:
      fieldsInUse('alcohol') ||
      fieldsInUse('allergens') ||
      fieldsInUse('additives') ||
      fieldsInUse('badges') ||
      (web && (document.outputs.web.filters.alcohol || document.outputs.web.filters.allergens)),
    needsRatings: fieldsInUse('rating'),
  };
}
