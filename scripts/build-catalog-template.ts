/**
 * Builds a built-in CATALOG template from its editable draft:
 * `templates/<key>/content-draft.json` (+ `ATTRIBUTION.md`, `images/`) →
 * `backup.json` (backup format, images as `file:images/<name>`) and the
 * `source` / `attributions` fields of `manifest.json`. Deterministic: the same
 * draft always yields the same files (ids are derived from the draft keys).
 *
 *   pnpm templates:build-catalog [key] [--bump]
 *
 * `--bump` increases the manifest version when backup.json changed (needed so
 * that running instances replace their database copy on the next start).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { z } from 'zod';
import { BackupImportSchema, findBackupReferenceIssues } from '../lib/backup/backupSchema';
import { DEFAULT_TAG_CATEGORIES } from '../lib/tags/defaultTagCategories';
import { TEMPLATES_DIR, TEMPLATE_IMAGE_PREFIX, resolveTemplateImages } from '../lib/templates/builtIn';
import { TEMPLATE_KEY_PATTERN, TemplateManifestSchema, type TemplateManifest } from '../lib/templates/manifest';
import { withAttributedImageCredits } from '../lib/templates/credits';
import {
  DEFAULT_FIELD_CONFIG,
  GUEST_MENU_OUTPUTS,
  GUEST_MENU_SCHEMA_VERSION,
  GuestMenuDocumentSchema,
  createDefaultOutputs,
  type GuestMenuDocument,
  type GuestMenuOutput,
} from '../lib/guest-menu/schema';
import { getBuiltInTemplate } from '../lib/guest-menu/templates';

type Localized = Record<string, string>;
type BackupInput = Required<z.input<typeof BackupImportSchema>>;

interface DraftIngredientRef {
  key: string;
  amount: number | null;
  unit: string;
  optional?: boolean;
}

interface Draft {
  meta: { key: string; kind: string; languages: string[] };
  tags: Record<string, { category: string; label: Localized; public?: boolean }>;
  cards: Array<{ key: string; name: string; groups: Array<{ key: string; name: string; cocktails: string[] }> }>;
  /** Guest menus on a card (`FIXED_CARD`, one section per card group), live after applying into a workspace without menus. */
  guestMenus?: Array<{
    key: string;
    name: string;
    card: string;
    /** Built-in template per output; theme tokens and web layout come from the `web` one. */
    design: Record<GuestMenuOutput, string>;
    title: Localized;
    subtitle?: Localized;
    /** Markdown text below the header (not on monitors). */
    intro?: Localized;
  }>;
  glasses: Array<{ key: string; name: Localized; volumeMl?: number; image?: string }>;
  ingredients: Array<{
    key: string;
    name: Localized;
    shortName?: Localized;
    abv?: number;
    allergens?: string[];
    allergenSources?: string[];
    additives?: string[];
    tags?: string[];
    bottleVolumeCl?: number;
  }>;
  garnishes: Array<{ key: string; name: Localized; allergens?: string[]; additives?: string[] }>;
  cocktails: Array<{
    key: string;
    name: Localized;
    description: Localized;
    history: Localized;
    tags: string[];
    glass: string;
    ice: string;
    garnishes: Array<{ key: string; optional?: boolean }>;
    steps: Array<{ action: string; actionGroup: string; ingredients: DraftIngredientRef[] }>;
    image?: string;
  }>;
}

const BASE_DIR = join(TEMPLATES_DIR, 'base');

function fail(message: string): never {
  throw new Error(message);
}

/** `meta.languages[0]` is the primary content language (texts on the entities), the others become translation rows. */
function texts(value: Localized, locales: string[], what: string): Localized {
  for (const locale of locales) if (!value[locale]?.trim()) fail(`${what}: missing "${locale}" text`);
  return value;
}

function uniqueKeys(rows: Array<{ key: string }>, what: string) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!TEMPLATE_KEY_PATTERN.test(row.key)) fail(`${what} "${row.key}": keys use lowercase letters, digits and dashes`);
    if (seen.has(row.key)) fail(`${what} "${row.key}" is defined twice`);
    seen.add(row.key);
  }
}

function uniqueNames(rows: Array<{ key: string; name: Localized }>, locales: string[], what: string) {
  // Template items are matched by name (duplicates in the target, image credits) → unique per language.
  for (const locale of locales) {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const name = row.name[locale]!.trim().toLocaleLowerCase();
      if (seen.has(name)) fail(`${what} "${row.key}" and "${seen.get(name)}" have the same ${locale} name`);
      seen.set(name, row.key);
    }
  }
}

const slug = (value: string) => value.toLowerCase().replace(/_/g, '-');

/** `> …` lines below `## Template source line (short)` and the `<file or glob>: <credit>` lines of the plain-text block. */
function parseAttribution(markdown: string): { source: string; credits: Array<{ pattern: string; credit: string }> } {
  const sourceSection = /## Template source line \(short\)\s*\n((?:>.*\n?)+)/.exec(markdown)?.[1];
  if (!sourceSection) fail('ATTRIBUTION.md: section "## Template source line (short)" with a "> …" quote not found');
  const source = sourceSection
    .split('\n')
    .map((line) => line.replace(/^>\s?/, '').trim())
    .filter(Boolean)
    .join(' ');

  const block = /## Plain-text lines[^\n]*\n+```[^\n]*\n([\s\S]*?)```/.exec(markdown)?.[1];
  if (!block) fail('ATTRIBUTION.md: code block below "## Plain-text lines" not found');
  const credits = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([A-Za-z0-9._*-]+):\s+(.+)$/.exec(line);
      if (!match) fail(`ATTRIBUTION.md: cannot parse credit line "${line}"`);
      return { pattern: match[1]!, credit: match[2]! };
    });
  return { source, credits };
}

function globToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
}

function buildBackup(draft: Draft) {
  const locales = draft.meta.languages;
  const [primary, ...translated] = locales;
  if (!primary) fail('meta.languages is empty');

  const base = JSON.parse(readFileSync(join(BASE_DIR, 'backup.json'), 'utf-8')) as {
    units: Array<{ id: string; name: string }>;
    unitConversions: Array<{ fromUnitId: string; toUnitId: string; factor: number; autoGenerated: boolean }>;
    workspaceSettings: Array<{ setting: string; value: string }>;
    stepActions: Array<{ id: string; name: string; actionGroup: string; dilutionPercent: number | null }>;
    ice: Array<{ id: string; name: string }>;
  };

  uniqueKeys(draft.glasses, 'Glass');
  uniqueKeys(draft.ingredients, 'Ingredient');
  uniqueKeys(draft.garnishes, 'Garnish');
  uniqueKeys(draft.cocktails, 'Cocktail');
  uniqueKeys(draft.cards, 'Card');
  for (const row of [...draft.glasses, ...draft.ingredients, ...draft.garnishes, ...draft.cocktails]) texts(row.name, locales, `"${row.key}" name`);
  uniqueNames(draft.glasses, locales, 'Glass');
  uniqueNames(draft.ingredients, locales, 'Ingredient');
  uniqueNames(draft.garnishes, locales, 'Garnish');
  uniqueNames(draft.cocktails, locales, 'Cocktail');

  const glassIds = new Map(draft.glasses.map((row) => [row.key, `glass-${row.key}`]));
  const ingredientIds = new Map(draft.ingredients.map((row) => [row.key, `ingredient-${row.key}`]));
  const garnishIds = new Map(draft.garnishes.map((row) => [row.key, `garnish-${row.key}`]));
  const cocktailIds = new Map(draft.cocktails.map((row) => [row.key, `cocktail-${row.key}`]));
  const ref = (ids: Map<string, string>, key: string, what: string) => ids.get(key) ?? fail(`Unknown ${what} "${key}"`);

  // Only the base units/actions/ice that are used; the import matches them by name in the target.
  const usedUnits = new Set<string>();
  const usedActions = new Set<string>();
  const usedIce = new Set<string>();
  const unitByName = new Map(base.units.map((unit) => [unit.name, unit]));
  const actionByName = new Map(base.stepActions.map((action) => [`${action.actionGroup}:${action.name}`, action]));
  const iceByName = new Map(base.ice.map((ice) => [ice.name, ice]));
  const unitId = (name: string) => {
    const unit = unitByName.get(name) ?? fail(`Unknown unit "${name}" (expected a base unit: ${[...unitByName.keys()].join(', ')})`);
    usedUnits.add(unit.id);
    return unit.id;
  };

  // Tags: every used tag needs a definition; categories are the default ones (matched by name on import).
  const categoryIds = new Map<string, string>();
  const tagDefinitions = Object.entries(draft.tags).map(([tag, definition]) => {
    const category =
      DEFAULT_TAG_CATEGORIES.find((candidate) => Object.values(candidate.name).includes(definition.category)) ??
      fail(`Tag "${tag}": unknown category "${definition.category}" (use a default category: ${DEFAULT_TAG_CATEGORIES.map((c) => c.name.en).join(', ')})`);
    const categoryId = `tag-category-${slug(category.name.en)}`;
    categoryIds.set(categoryId, categoryId);
    return { tag, label: texts(definition.label, locales, `Tag "${tag}" label`), categoryId, color: null, isPublic: definition.public ?? true };
  });
  const usedTags = new Set<string>();
  const tagsOf = (tags: string[] | undefined, what: string) => {
    for (const tag of tags ?? []) {
      if (!draft.tags[tag]) fail(`${what}: tag "${tag}" has no entry in "tags"`);
      usedTags.add(tag);
    }
    return tags ?? [];
  };

  const images = new Set<string>();
  const image = (reference: string | undefined, what: string) => {
    if (!reference) return [];
    if (!reference.startsWith(TEMPLATE_IMAGE_PREFIX)) fail(`${what}: image must be "${TEMPLATE_IMAGE_PREFIX}<name>"`);
    images.add(reference.slice(TEMPLATE_IMAGE_PREFIX.length));
    return [reference];
  };

  const glass = draft.glasses.map((row) => ({
    id: glassIds.get(row.key)!,
    name: row.name[primary]!,
    notes: null,
    volume: row.volumeMl != null ? row.volumeMl / 10 : null,
    deposit: 0,
  }));
  const glassImages = draft.glasses.flatMap((row) => image(row.image, `Glass "${row.key}"`).map((file) => ({ glassId: glassIds.get(row.key)!, image: file })));

  const ingredient = draft.ingredients.map((row) => ({
    id: ingredientIds.get(row.key)!,
    name: row.name[primary]!,
    // shortName has no translation column: only kept when it is the same in every language.
    shortName: row.shortName && new Set(locales.map((locale) => row.shortName![locale])).size === 1 ? row.shortName[primary]! : null,
    description: null,
    notes: null,
    price: null,
    link: null,
    tags: tagsOf(row.tags, `Ingredient "${row.key}"`),
    abv: row.abv ?? null,
    allergens: row.allergens ?? [],
    allergenSources: row.allergenSources ?? [],
    additives: row.additives ?? [],
    guestInfoComplete: false,
    hideOnGuestMenu: false,
    guestName: null,
  }));
  const ingredientVolumes = draft.ingredients.flatMap((row) =>
    row.bottleVolumeCl != null ? [{ ingredientId: ingredientIds.get(row.key)!, unitId: unitId('CL'), volume: row.bottleVolumeCl }] : [],
  );

  const garnish = draft.garnishes.map((row) => ({
    id: garnishIds.get(row.key)!,
    name: row.name[primary]!,
    description: null,
    notes: null,
    price: null,
    allergens: row.allergens ?? [],
    allergenSources: [],
    additives: row.additives ?? [],
    guestInfoComplete: false,
  }));

  const cocktailRecipe: BackupInput['cocktailRecipe'] = [];
  const cocktailRecipeImage: BackupInput['cocktailRecipeImage'] = [];
  const cocktailRecipeStep: BackupInput['cocktailRecipeStep'] = [];
  const cocktailRecipeIngredient: BackupInput['cocktailRecipeIngredient'] = [];
  const cocktailRecipeGarnish: BackupInput['cocktailRecipeGarnish'] = [];
  for (const row of draft.cocktails) {
    const id = cocktailIds.get(row.key)!;
    const what = `Cocktail "${row.key}"`;
    texts(row.description, locales, `${what} description`);
    texts(row.history, locales, `${what} history`);
    const ice = iceByName.get(row.ice) ?? fail(`${what}: unknown ice "${row.ice}"`);
    usedIce.add(ice.id);
    cocktailRecipe.push({
      id,
      name: row.name[primary]!,
      description: row.description[primary]!,
      notes: null,
      history: row.history[primary]!,
      tags: tagsOf(row.tags, what),
      price: null,
      iceId: ice.id,
      glassId: ref(glassIds, row.glass, `glass in ${what}`),
      isArchived: false,
      abvOverride: null,
      extraAllergens: [],
      extraAdditives: [],
    });
    for (const file of image(row.image, what)) cocktailRecipeImage.push({ cocktailRecipeId: id, image: file });
    row.steps.forEach((step, stepNumber) => {
      const action = actionByName.get(`${step.actionGroup}:${step.action}`) ?? fail(`${what}: unknown step action "${step.actionGroup}:${step.action}"`);
      usedActions.add(action.id);
      const stepId = `step-${row.key}-${stepNumber}`;
      cocktailRecipeStep.push({ id: stepId, stepNumber, optional: false, actionId: action.id, cocktailRecipeId: id });
      step.ingredients.forEach((entry, ingredientNumber) => {
        cocktailRecipeIngredient.push({
          ingredientNumber,
          optional: entry.optional ?? false,
          amount: entry.amount,
          unitId: unitId(entry.unit),
          ingredientId: ref(ingredientIds, entry.key, `ingredient in ${what}`),
          cocktailRecipeStepId: stepId,
        });
      });
    });
    row.garnishes.forEach((entry, garnishNumber) => {
      cocktailRecipeGarnish.push({
        cocktailRecipeId: id,
        garnishId: ref(garnishIds, entry.key, `garnish in ${what}`),
        description: null,
        garnishNumber,
        optional: entry.optional ?? false,
        isAlternative: false,
      });
    });
  }

  const cocktailCard = draft.cards.map((card) => ({ id: `card-${card.key}`, name: card.name, date: null, archived: false }));
  const cocktailCardGroup = draft.cards.flatMap((card) =>
    card.groups.map((group, groupNumber) => ({
      id: `card-group-${card.key}-${group.key}`,
      groupNumber,
      name: group.name,
      cocktailCardId: `card-${card.key}`,
      groupPrice: null,
    })),
  );
  const cocktailCardGroupItem = draft.cards.flatMap((card) =>
    card.groups.flatMap((group) =>
      group.cocktails.map((key, itemNumber) => ({
        itemNumber,
        cocktailCardGroupId: `card-group-${card.key}-${group.key}`,
        cocktailId: ref(cocktailIds, key, `cocktail in card group "${group.key}"`),
        specialPrice: null,
      })),
    ),
  );

  const cardIds = new Map(draft.cards.map((card) => [card.key, `card-${card.key}`]));
  uniqueKeys(draft.guestMenus ?? [], 'Guest menu');
  const guestMenus = (draft.guestMenus ?? []).map((menu) => {
    const what = `Guest menu "${menu.key}"`;
    const document = buildGuestMenuDocument(menu, locales, what);
    return {
      id: `guest-menu-${menu.key}`,
      name: menu.name,
      slug: menu.key,
      priority: 0,
      weekdays: [],
      inactiveBehavior: 'NOTICE_WITH_LINK' as const,
      sourceMode: 'FIXED_CARD' as const,
      sourceCardId: ref(cardIds, menu.card, `card in ${what}`),
      locales: [],
      // Applied as is only into a workspace without guest menus (setup wizard); otherwise disabled and unpublished.
      enabled: true,
      isDefault: true,
      published: document,
      draft: document,
    };
  });

  const unused = Object.keys(draft.tags).filter((tag) => !usedTags.has(tag));
  if (unused.length > 0) fail(`Tags defined but not used: ${unused.join(', ')}`);
  const translationsSetting = base.workspaceSettings.find((row) => row.setting === 'translations');

  return {
    images,
    backup: {
      units: base.units.filter((unit) => usedUnits.has(unit.id)),
      unitConversions: base.unitConversions.filter((row) => usedUnits.has(row.fromUnitId) && usedUnits.has(row.toUnitId)),
      // Labels of units/actions/ice; merged into the target (existing labels win).
      workspaceSettings: translationsSetting ? [translationsSetting] : [],
      stepActions: base.stepActions.filter((action) => usedActions.has(action.id)),
      garnish,
      garnishImages: [],
      ingredient,
      ingredientVolumes,
      ingredientImages: [],
      glass,
      glassImages,
      cocktailRecipe,
      cocktailRecipeImage,
      cocktailRecipeStep,
      cocktailRecipeGarnish,
      cocktailRecipeIngredient,
      cocktailCard,
      cocktailCardGroup,
      cocktailCardGroupItem,
      calculation: [],
      calculationGroups: [],
      calculationItems: [],
      ice: base.ice.filter((ice) => usedIce.has(ice.id)),
      tagCategories: DEFAULT_TAG_CATEGORIES.filter((category) => categoryIds.has(`tag-category-${slug(category.name.en)}`)).map((category) => ({
        id: `tag-category-${slug(category.name.en)}`,
        ...category,
      })),
      tagDefinitions,
      cocktailRecipeTranslations: translated.flatMap((locale) =>
        draft.cocktails.map((row) => ({
          cocktailId: cocktailIds.get(row.key)!,
          locale,
          name: row.name[locale]!,
          description: row.description[locale]!,
          history: row.history[locale]!,
        })),
      ),
      ingredientTranslations: translated.flatMap((locale) =>
        draft.ingredients.map((row) => ({ ingredientId: ingredientIds.get(row.key)!, locale, name: row.name[locale]!, guestName: null, description: null })),
      ),
      garnishTranslations: translated.flatMap((locale) =>
        draft.garnishes.map((row) => ({ garnishId: garnishIds.get(row.key)!, locale, name: row.name[locale]!, description: null })),
      ),
      glassTranslations: translated.flatMap((locale) => draft.glasses.map((row) => ({ glassId: glassIds.get(row.key)!, locale, name: row.name[locale]! }))),
      guestMenus,
    },
  };
}

/** Deterministic guest menu document: header, intro, all groups of the card, allergen notice; design of built-in templates. */
function buildGuestMenuDocument(menu: NonNullable<Draft['guestMenus']>[number], locales: string[], what: string): GuestMenuDocument {
  for (const output of GUEST_MENU_OUTPUTS) {
    if (!getBuiltInTemplate(menu.design[output])) fail(`${what}: unknown built-in template "${menu.design[output]}" for ${output}`);
  }
  const web = getBuiltInTemplate(menu.design.web)!;
  const outputs = createDefaultOutputs();
  const document: GuestMenuDocument = {
    schemaVersion: GUEST_MENU_SCHEMA_VERSION,
    title: texts(menu.title, locales, `${what} title`),
    ...(menu.subtitle ? { subtitle: texts(menu.subtitle, locales, `${what} subtitle`) } : {}),
    theme: { preset: web.id, tokens: structuredClone(web.defaultTokens) },
    templates: { web: { templateId: menu.design.web }, monitor: { templateId: menu.design.monitor }, print: { templateId: menu.design.print } },
    outputs: { ...outputs, web: { ...outputs.web, layout: web.layout } },
    defaults: { fields: { ...DEFAULT_FIELD_CONFIG } },
    blocks: [
      { id: 'header', type: 'header', showLogo: true, showTitle: true, showSubtitle: true },
      ...(menu.intro ? [{ id: 'intro', type: 'text' as const, content: texts(menu.intro, locales, `${what} intro`), outputs: { monitor: false } }] : []),
      { id: 'section-card', type: 'section', title: {}, source: { kind: 'cardAllGroups' }, overrides: {} },
      { id: 'notice-allergens', type: 'notice', preset: 'allergens' },
    ],
  };
  const parsed = GuestMenuDocumentSchema.safeParse(document);
  if (!parsed.success) fail(`${what}: invalid document: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`);
  return parsed.data;
}

async function writeFormatted(path: string, value: unknown) {
  const options = (await resolveConfig(path)) ?? {};
  writeFileSync(path, await format(JSON.stringify(value), { ...options, filepath: path }));
}

async function main() {
  const args = process.argv.slice(2);
  const key = args.find((arg) => !arg.startsWith('--')) ?? 'all-time-classics';
  const bump = args.includes('--bump');
  if (!TEMPLATE_KEY_PATTERN.test(key)) fail(`Invalid template key "${key}"`);
  const dir = join(TEMPLATES_DIR, key);
  const draft = JSON.parse(readFileSync(join(dir, 'content-draft.json'), 'utf-8')) as Draft;
  if (draft.meta.key !== key) fail(`content-draft.json meta.key "${draft.meta.key}" does not match "${key}"`);
  if (draft.meta.kind !== 'CATALOG') fail('Only CATALOG drafts are supported');

  const { backup: uncredited, images } = buildBackup(draft);

  // Image credits: every referenced image needs one; files in images/ must be referenced.
  const attribution = parseAttribution(readFileSync(join(dir, 'ATTRIBUTION.md'), 'utf-8'));
  const files = readdirSync(join(dir, 'images')).filter((name) => !name.startsWith('.'));
  const unreferenced = files.filter((name) => !images.has(name));
  if (unreferenced.length > 0) fail(`Images not used by the draft: ${unreferenced.join(', ')}`);
  const attributions: Record<string, string> = {};
  for (const name of [...images].sort()) {
    const credit = attribution.credits.find(({ pattern }) => globToRegExp(pattern).test(name));
    if (!credit) fail(`ATTRIBUTION.md has no credit line for images/${name}`);
    attributions[name] = credit.credit;
  }
  // Credits travel with the image rows (template workspace → every workspace the template is applied to).
  const backup = withAttributedImageCredits(uncredited, attributions);

  // Same checks as the loader/import (images resolved).
  const parsed = BackupImportSchema.parse(resolveTemplateImages(JSON.parse(JSON.stringify(backup)), dir));
  const issues = findBackupReferenceIssues(parsed);
  if (issues.length > 0) fail(`Broken references: ${JSON.stringify(issues.slice(0, 5))}`);

  const backupPath = join(dir, 'backup.json');
  const previous = existsSync(backupPath) ? readFileSync(backupPath, 'utf-8') : null;
  await writeFormatted(backupPath, backup);
  const changed = previous !== readFileSync(backupPath, 'utf-8');

  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) fail(`${manifestPath} is missing (key, kind, version, name, description, locales, published)`);
  const manifest: TemplateManifest = TemplateManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf-8')));
  if (manifest.kind !== 'CATALOG' || manifest.key !== key) fail('manifest.json: key/kind do not match the draft');
  if (manifest.locales.join() !== draft.meta.languages.join()) fail(`manifest.json locales must be ${JSON.stringify(draft.meta.languages)}`);
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
  const creditsChanged = raw.source !== attribution.source || JSON.stringify(raw.attributions) !== JSON.stringify(attributions);
  const version = bump && (changed || creditsChanged) ? manifest.version + 1 : manifest.version;
  const next = { ...raw, version, source: attribution.source, attributions };
  TemplateManifestSchema.parse(next);
  await writeFormatted(manifestPath, next);

  const counts = `${backup.glass.length} glasses, ${backup.ingredient.length} ingredients, ${backup.garnish.length} garnishes, ${backup.cocktailRecipe.length} cocktails, ${backup.cocktailCard.length} cards, ${backup.guestMenus.length} guest menus, ${images.size} images`;
  console.info(`[${key}] ${counts}`);
  console.info(`[${key}] backup.json ${changed ? 'updated' : 'unchanged'}, credits ${creditsChanged ? 'updated' : 'unchanged'}, manifest version ${version}`);
  if ((changed || creditsChanged) && !bump && previous !== null) {
    console.info(`[${key}] Content changed: run with --bump (or raise "version" in manifest.json) so that instances replace their copy.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
