/**
 * GuestMenu document schema (stored in `GuestMenu.draft` / `GuestMenu.published`)
 * and the resolved public DTO. Binding spec: docs/GUEST-MENU-CONCEPT.md.
 *
 * Pure module (zod + type-only Prisma imports) so it can be shared by the
 * builder (client), the resolver (server) and scripts/generate-openapi.ts.
 *
 * Uses the OpenAPI-extended `z`: zod 4 copies prototype methods onto instances
 * at construction time, so schemas built before `extendZodWithOpenApi` ran
 * have no `.openapi()` (lib/schemas/guestMenus.ts calls it on the document).
 */
import { z } from '@lib/openapi/zod';
import type { Additive, Allergen, AlcoholCategory, AlcoholStatus } from '@lib/guest-info/constants';
import type { LocalizedText } from './localizedText';

export type { LocalizedText };

export const GUEST_MENU_SCHEMA_VERSION = 1 as const;

const MAX_SHORT_TEXT = 500;
const MAX_LONG_TEXT = 20_000;
const MAX_TEMPLATE_SIZE = 100_000;
/** Images are stored inline (data URL) like the rest of the app; ~5 MB of base64. */
const MAX_IMAGE_SIZE = 5_000_000;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const LocaleKey = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Invalid locale code');

export const LocalizedTextSchema = z.record(LocaleKey, z.string().max(MAX_LONG_TEXT));
const LocalizedShortTextSchema = z.record(LocaleKey, z.string().max(MAX_SHORT_TEXT));

const ColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected a hex color');

const BlockId = z.string().min(1).max(64);

export const GUEST_MENU_OUTPUTS = ['web', 'monitor', 'print'] as const;
export type GuestMenuOutput = (typeof GUEST_MENU_OUTPUTS)[number];

const OutputVisibilitySchema = z
  .object({
    web: z.boolean().optional(),
    monitor: z.boolean().optional(),
    print: z.boolean().optional(),
  })
  .optional();
/** Per-output visibility of a block; `undefined` = visible. */
export type OutputVisibility = z.infer<typeof OutputVisibilitySchema>;

// ---------------------------------------------------------------------------
// Fields (Informationsbausteine)
// ---------------------------------------------------------------------------

/**
 * - `off`: never shown
 * - `list`: shown in the list item (and in the detail view)
 * - `detail`: only shown in the detail view (web detail sheet)
 * - `expandable`: shown in the list behind an expand toggle
 * Monitor and print have no detail view: there `detail`/`expandable` behave like `off`/`list`.
 */
export const FIELD_MODES = ['off', 'list', 'detail', 'expandable'] as const;
export type FieldMode = (typeof FIELD_MODES)[number];
export const FieldModeSchema = z.enum(FIELD_MODES);

export const FIELD_KEYS = [
  'price',
  'ingredients',
  'amounts',
  'flavors',
  'badges',
  'image',
  'description',
  'history',
  'glass',
  'garnish',
  'rating',
  'alcohol',
  'allergens',
  'additives',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const ALCOHOL_DISPLAYS = ['badgeOnly', 'category', 'percent', 'percentAndGrams'] as const;
export type AlcoholDisplay = (typeof ALCOHOL_DISPLAYS)[number];
export const ALLERGEN_DISPLAYS = ['icons', 'codes', 'footnotes'] as const;
export type AllergenDisplay = (typeof ALLERGEN_DISPLAYS)[number];
export const ADDITIVE_DISPLAYS = ['footnotes'] as const;
export type AdditiveDisplay = (typeof ADDITIVE_DISPLAYS)[number];

export const FieldConfigSchema = z.object({
  price: FieldModeSchema,
  ingredients: FieldModeSchema,
  /** Never public unless explicitly opted in. */
  amounts: FieldModeSchema,
  /** Public tags (TagDefinition.isPublic). */
  flavors: FieldModeSchema,
  badges: FieldModeSchema,
  image: FieldModeSchema,
  description: FieldModeSchema,
  history: FieldModeSchema,
  glass: FieldModeSchema,
  garnish: FieldModeSchema,
  rating: FieldModeSchema,
  alcohol: FieldModeSchema,
  allergens: FieldModeSchema,
  additives: FieldModeSchema,
  alcoholDisplay: z.enum(ALCOHOL_DISPLAYS),
  allergenDisplay: z.enum(ALLERGEN_DISPLAYS),
  additiveDisplay: z.enum(ADDITIVE_DISPLAYS),
});
export type FieldConfig = z.infer<typeof FieldConfigSchema>;

export const PartialFieldConfigSchema = FieldConfigSchema.partial();
export type PartialFieldConfig = z.infer<typeof PartialFieldConfigSchema>;

/** Base field config (document `defaults.fields`). Amounts are always off by default. */
export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  price: 'list',
  ingredients: 'list',
  amounts: 'off',
  flavors: 'list',
  badges: 'list',
  image: 'list',
  description: 'detail',
  history: 'detail',
  glass: 'detail',
  garnish: 'detail',
  rating: 'off',
  alcohol: 'list',
  allergens: 'detail',
  additives: 'detail',
  alcoholDisplay: 'category',
  allergenDisplay: 'icons',
  additiveDisplay: 'footnotes',
};

/** Effective defaults per output. Amounts are always off by default. */
export const DEFAULT_FIELD_CONFIG_BY_OUTPUT: Record<GuestMenuOutput, FieldConfig> = {
  web: { ...DEFAULT_FIELD_CONFIG },
  monitor: {
    ...DEFAULT_FIELD_CONFIG,
    flavors: 'off',
    image: 'off',
    description: 'off',
    history: 'off',
    glass: 'off',
    garnish: 'off',
    rating: 'off',
    alcohol: 'off',
    allergens: 'off',
    additives: 'off',
  },
  print: {
    ...DEFAULT_FIELD_CONFIG,
    flavors: 'off',
    image: 'off',
    description: 'list',
    history: 'off',
    glass: 'off',
    garnish: 'off',
    rating: 'off',
    alcohol: 'list',
    allergens: 'list',
    additives: 'list',
    allergenDisplay: 'footnotes',
  },
};

/** Keys of `target` that differ from `base` (partial override layer). */
export function diffFieldConfig(base: FieldConfig, target: FieldConfig): PartialFieldConfig {
  const diff: PartialFieldConfig = {};
  for (const key of Object.keys(target) as (keyof FieldConfig)[]) {
    if (target[key] !== base[key]) (diff as Record<string, unknown>)[key] = target[key];
  }
  return diff;
}

/**
 * Per-output override layers for new documents: only what differs from
 * `DEFAULT_FIELD_CONFIG`, so changes to `defaults.fields` still apply to every output.
 */
export function createDefaultOutputFieldOverrides(output: GuestMenuOutput): PartialFieldConfig {
  return diffFieldConfig(DEFAULT_FIELD_CONFIG, DEFAULT_FIELD_CONFIG_BY_OUTPUT[output]);
}

/**
 * Inheritance from the spec: `defaults.fields` → `outputs[output].fields` →
 * `section.fields` → `override.fields` (partial, `undefined` = inherit).
 */
export function resolveFieldConfig(
  document: Pick<GuestMenuDocument, 'defaults' | 'outputs'>,
  output: GuestMenuOutput,
  ...layers: (PartialFieldConfig | null | undefined)[]
): FieldConfig {
  const result: FieldConfig = { ...document.defaults.fields };
  for (const layer of [document.outputs[output].fields, ...layers]) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/** Curated fonts. `css` is the CSS font-family stack used for `--gm-font-*`. */
export const GUEST_MENU_FONTS = [
  { id: 'system-sans', label: 'System Sans', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'system-serif', label: 'System Serif', css: 'Georgia, "Times New Roman", serif' },
  { id: 'inter', label: 'Inter', css: '"Inter", system-ui, sans-serif' },
  { id: 'dm-sans', label: 'DM Sans', css: '"DM Sans", system-ui, sans-serif' },
  { id: 'montserrat', label: 'Montserrat', css: '"Montserrat", system-ui, sans-serif' },
  { id: 'raleway', label: 'Raleway', css: '"Raleway", system-ui, sans-serif' },
  { id: 'josefin-sans', label: 'Josefin Sans', css: '"Josefin Sans", system-ui, sans-serif' },
  { id: 'oswald', label: 'Oswald', css: '"Oswald", "Arial Narrow", sans-serif' },
  { id: 'playfair-display', label: 'Playfair Display', css: '"Playfair Display", Georgia, serif' },
  { id: 'cormorant-garamond', label: 'Cormorant Garamond', css: '"Cormorant Garamond", Georgia, serif' },
  { id: 'lora', label: 'Lora', css: '"Lora", Georgia, serif' },
  { id: 'libre-baskerville', label: 'Libre Baskerville', css: '"Libre Baskerville", Georgia, serif' },
] as const;
export type GuestMenuFontId = (typeof GUEST_MENU_FONTS)[number]['id'];
const FONT_IDS = GUEST_MENU_FONTS.map((f) => f.id) as [GuestMenuFontId, ...GuestMenuFontId[]];
export const GuestMenuFontIdSchema = z.enum(FONT_IDS);

export const THEME_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export type ThemeDensity = (typeof THEME_DENSITIES)[number];

export const ThemeColorsSchema = z.object({
  bg: ColorSchema,
  surface: ColorSchema,
  text: ColorSchema,
  muted: ColorSchema,
  accent: ColorSchema,
  accentContrast: ColorSchema,
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

export const ThemeTokensSchema = z.object({
  colors: ThemeColorsSchema,
  fontHeading: GuestMenuFontIdSchema,
  fontBody: GuestMenuFontIdSchema,
  /** Corner radius in px (`--gm-radius`). */
  radius: z.number().min(0).max(48),
  density: z.enum(THEME_DENSITIES),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const ThemeSchema = z.object({
  /** Built-in theme preset id the tokens were derived from (e.g. `classic`). */
  preset: z.string().min(1).max(64),
  tokens: ThemeTokensSchema,
  /** Image URL or data URL. */
  backgroundImage: z.string().max(MAX_IMAGE_SIZE).nullish(),
  /** Image URL or data URL. */
  logo: z.string().max(MAX_IMAGE_SIZE).nullish(),
  /** Raw user CSS; scoped to `.gm-root` and sanitized at render time. */
  customCss: z.string().max(MAX_TEMPLATE_SIZE).nullish(),
});
export type GuestMenuTheme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME_PRESET = 'classic';

export const DEFAULT_THEME: GuestMenuTheme = {
  preset: DEFAULT_THEME_PRESET,
  tokens: {
    colors: {
      bg: '#faf7f2',
      surface: '#ffffff',
      text: '#1f1b16',
      muted: '#6b6259',
      accent: '#9c3d22',
      accentContrast: '#ffffff',
    },
    fontHeading: 'playfair-display',
    fontBody: 'inter',
    radius: 12,
    density: 'comfortable',
  },
};

// ---------------------------------------------------------------------------
// Templates (Liquid slots)
// ---------------------------------------------------------------------------

export const TEMPLATE_SLOTS = ['menu_header', 'section_header', 'item', 'item_detail', 'footer'] as const;
export type TemplateSlot = (typeof TEMPLATE_SLOTS)[number];

export const TemplateSlotOverridesSchema = z.object({
  menu_header: z.string().max(MAX_TEMPLATE_SIZE).optional(),
  section_header: z.string().max(MAX_TEMPLATE_SIZE).optional(),
  item: z.string().max(MAX_TEMPLATE_SIZE).optional(),
  item_detail: z.string().max(MAX_TEMPLATE_SIZE).optional(),
  footer: z.string().max(MAX_TEMPLATE_SIZE).optional(),
  css: z.string().max(MAX_TEMPLATE_SIZE).optional(),
});
export type TemplateSlotOverrides = z.infer<typeof TemplateSlotOverridesSchema>;

/** Prefix for workspace templates (`GuestMenuTemplate.id`) in `templateId`. */
export const CUSTOM_TEMPLATE_PREFIX = 'custom:';

export const TemplateRefSchema = z.object({
  /** Built-in template id (lib/guest-menu/templates/*) or `custom:<GuestMenuTemplate.id>`. */
  templateId: z.string().min(1).max(128),
  slots: TemplateSlotOverridesSchema.optional(),
});
export type TemplateRef = z.infer<typeof TemplateRefSchema>;

export const DEFAULT_TEMPLATE_ID: Record<GuestMenuOutput, string> = {
  web: 'classic',
  monitor: 'classic',
  print: 'classic',
};

export const TemplatesSchema = z.object({
  web: TemplateRefSchema,
  monitor: TemplateRefSchema,
  print: TemplateRefSchema,
});
export type GuestMenuTemplates = z.infer<typeof TemplatesSchema>;

/** Shape of `GuestMenuTemplate.definition` (workspace-level reusable template). */
export const GuestMenuTemplateDefinitionSchema = z.object({
  schemaVersion: z.literal(GUEST_MENU_SCHEMA_VERSION),
  /** Built-in template the slots fall back to. */
  baseTemplateId: z.string().min(1).max(128),
  slots: TemplateSlotOverridesSchema,
  theme: ThemeSchema.optional(),
});
export type GuestMenuTemplateDefinition = z.infer<typeof GuestMenuTemplateDefinitionSchema>;

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export const MAX_CUSTOM_FILTERS = 30;

/**
 * Self-defined guest filter. A cocktail matches if it carries at least one of
 * `tags` (own tags or tags of its ingredients, public or not – matching happens
 * on the server, only filter ids reach the guest). Several selected custom
 * filters narrow down (AND).
 */
export const CustomFilterSchema = z.object({
  id: z.string().min(1).max(64),
  label: LocalizedTextSchema,
  tags: z.array(z.string().min(1).max(100)).max(50),
  /** Also show as quick chip above the menu (default true). */
  quick: z.boolean().optional(),
});
export type CustomFilter = z.infer<typeof CustomFilterSchema>;

export const LAYOUTS = ['list', 'compact', 'grid', 'cards', 'tiles', 'gallery'] as const;
export type GuestMenuLayout = (typeof LAYOUTS)[number];
export const LayoutSchema = z.enum(LAYOUTS);

/** Layouts built for touch screens; monitor and print fall back to a static grid. */
export const WEB_ONLY_LAYOUTS: readonly GuestMenuLayout[] = ['tiles', 'gallery'];

export function layoutsForOutput(output: GuestMenuOutput): readonly GuestMenuLayout[] {
  return output === 'web' ? LAYOUTS : LAYOUTS.filter((layout) => !WEB_ONLY_LAYOUTS.includes(layout));
}

export function resolveLayoutForOutput(layout: GuestMenuLayout, output: GuestMenuOutput): GuestMenuLayout {
  return output !== 'web' && WEB_ONLY_LAYOUTS.includes(layout) ? 'grid' : layout;
}

export const WEB_SORTS = ['menu', 'name', 'price'] as const;
export type WebSort = (typeof WEB_SORTS)[number];

export const WebOutputSchema = z.object({
  enabled: z.boolean(),
  layout: LayoutSchema,
  fields: PartialFieldConfigSchema,
  search: z.object({
    enabled: z.boolean(),
    /** Search also finds non-archived cocktails outside the menu, marked "on request". */
    includeOnRequest: z.boolean(),
    ingredientsSearchable: z.boolean(),
  }),
  filters: z.object({
    /** Tag category ids to offer as filters, or `auto` (categories with showAsGuestFilter). */
    categories: z.union([z.literal('auto'), z.array(z.string().min(1))]),
    /** "Without X" allergen filters (only cocktails with complete info match). */
    allergens: z.boolean(),
    /** Alcohol category filter (alcohol-free / light / medium / strong). */
    alcohol: z.boolean(),
    /** Heading of the custom filters in the filter sheet (default: guest UI text). */
    customTitle: LocalizedTextSchema.optional(),
    /** Self-defined filters (e.g. "Alkoholfrei" → tags `alkoholfrei` OR `mocktail`). */
    custom: z.array(CustomFilterSchema).max(MAX_CUSTOM_FILTERS).optional(),
  }),
  /** Initial sort; `menu` = order of the document. */
  sort: z.enum(WEB_SORTS),
  /** Ask search engines not to index the public page (`noindex`). Previews are never indexed. */
  noindex: z.boolean().optional(),
});
export type WebOutput = z.infer<typeof WebOutputSchema>;

export const MONITOR_LOCALE_MODES = ['primary', 'fixed', 'rotate'] as const;
export type MonitorLocaleMode = (typeof MONITOR_LOCALE_MODES)[number];

export const MonitorOutputSchema = z.object({
  enabled: z.boolean(),
  layout: LayoutSchema,
  fields: PartialFieldConfigSchema,
  columns: z.union([z.literal('auto'), z.number().int().min(1).max(6)]),
  pageDurationSeconds: z.number().int().min(3).max(600),
  showQrCode: z.boolean(),
  /** `primary`: content primary locale; `fixed`: `locale`; `rotate`: cycle through menu locales per page cycle. */
  localeMode: z.enum(MONITOR_LOCALE_MODES),
  locale: LocaleKey.nullish(),
});
export type MonitorOutput = z.infer<typeof MonitorOutputSchema>;

export const PRINT_PAPERS = ['A4', 'A5', 'DL'] as const;
export type PrintPaper = (typeof PRINT_PAPERS)[number];

export const PrintOutputSchema = z.object({
  enabled: z.boolean(),
  layout: LayoutSchema,
  fields: PartialFieldConfigSchema,
  paper: z.enum(PRINT_PAPERS),
  /** `null` = content primary locale. */
  locale: LocaleKey.nullish(),
  showQrCode: z.boolean(),
});
export type PrintOutput = z.infer<typeof PrintOutputSchema>;

export const OutputsSchema = z.object({
  web: WebOutputSchema,
  monitor: MonitorOutputSchema,
  print: PrintOutputSchema,
});
export type GuestMenuOutputs = z.infer<typeof OutputsSchema>;

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const HIGHLIGHTS = ['recommendation', 'new', 'signature'] as const;
export type GuestMenuHighlight = (typeof HIGHLIGHTS)[number];

export const ItemOverrideSchema = z.object({
  hidden: z.boolean().optional(),
  highlight: z.enum(HIGHLIGHTS).nullish(),
  description: LocalizedTextSchema.optional(),
  /** Overrides all other prices (last in precedence chain). `null` = hide price. */
  price: z.number().min(0).nullish(),
  fields: PartialFieldConfigSchema.optional(),
});
export type ItemOverride = z.infer<typeof ItemOverrideSchema>;

export const RULE_SORTS = ['name', 'price'] as const;

export const SectionSourceSchema = z.discriminatedUnion('kind', [
  /** All groups of the source card, expanded to one section per group. */
  z.object({ kind: z.literal('cardAllGroups') }),
  /** One group of the source card (group ids are stable). */
  z.object({ kind: z.literal('cardGroup'), groupId: z.string().min(1) }),
  z.object({ kind: z.literal('manual'), cocktailIds: z.array(z.string().min(1)).max(500) }),
  z.object({
    kind: z.literal('rule'),
    tags: z.array(z.string().min(1)).max(100),
    ingredientIds: z.array(z.string().min(1)).max(100),
    logic: z.enum(['AND', 'OR']),
    sort: z.enum(RULE_SORTS),
  }),
]);
export type SectionSource = z.infer<typeof SectionSourceSchema>;
export type SectionSourceKind = SectionSource['kind'];

export const HeaderBlockSchema = z.object({
  id: BlockId,
  type: z.literal('header'),
  showLogo: z.boolean(),
  showTitle: z.boolean(),
  showSubtitle: z.boolean(),
  outputs: OutputVisibilitySchema,
});

export const SectionBlockSchema = z.object({
  id: BlockId,
  type: z.literal('section'),
  /** Empty = use card group name (for card sources). */
  title: LocalizedShortTextSchema,
  description: LocalizedTextSchema.optional(),
  source: SectionSourceSchema,
  layout: LayoutSchema.optional(),
  fields: PartialFieldConfigSchema.optional(),
  /** Keyed by cocktail id. */
  overrides: z.record(z.string(), ItemOverrideSchema),
  outputs: OutputVisibilitySchema,
});

export const TextBlockSchema = z.object({
  id: BlockId,
  type: z.literal('text'),
  /** Markdown. */
  content: LocalizedTextSchema,
  outputs: OutputVisibilitySchema,
});

export const ImageBlockSchema = z.object({
  id: BlockId,
  type: z.literal('image'),
  /** Image URL or data URL. */
  src: z.string().min(1).max(MAX_IMAGE_SIZE),
  alt: LocalizedShortTextSchema.optional(),
  outputs: OutputVisibilitySchema,
});

export const DividerBlockSchema = z.object({
  id: BlockId,
  type: z.literal('divider'),
  outputs: OutputVisibilitySchema,
});

export const NOTICE_PRESETS = ['allergens', 'deposit', 'custom'] as const;
export type NoticePreset = (typeof NOTICE_PRESETS)[number];

export const NoticeBlockSchema = z.object({
  id: BlockId,
  type: z.literal('notice'),
  preset: z.enum(NOTICE_PRESETS),
  /** Required for `custom`; for presets it overrides the default text. Markdown. */
  text: LocalizedTextSchema.optional(),
  outputs: OutputVisibilitySchema,
});

export const BlockSchema = z.discriminatedUnion('type', [
  HeaderBlockSchema,
  SectionBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  DividerBlockSchema,
  NoticeBlockSchema,
]);
export type HeaderBlock = z.infer<typeof HeaderBlockSchema>;
export type SectionBlock = z.infer<typeof SectionBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type DividerBlock = z.infer<typeof DividerBlockSchema>;
export type NoticeBlock = z.infer<typeof NoticeBlockSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block['type'];

export function isBlockVisibleInOutput(block: Pick<Block, 'outputs'>, output: GuestMenuOutput): boolean {
  return block.outputs?.[output] !== false;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/** Default notice texts that can be overridden per menu (`noticeTexts`). */
export const NOTICE_TEXT_KEYS = ['allergens', 'deposit', 'unavailable', 'onRequest', 'alcoholApprox'] as const;
export type NoticeTextKey = (typeof NOTICE_TEXT_KEYS)[number];

export const GuestMenuDocumentSchema = z
  .object({
    schemaVersion: z.literal(GUEST_MENU_SCHEMA_VERSION),
    title: LocalizedShortTextSchema,
    subtitle: LocalizedShortTextSchema.optional(),
    theme: ThemeSchema,
    templates: TemplatesSchema,
    outputs: OutputsSchema,
    defaults: z.object({ fields: FieldConfigSchema }),
    blocks: z.array(BlockSchema).max(500),
    noticeTexts: z.partialRecord(z.enum(NOTICE_TEXT_KEYS), LocalizedTextSchema).optional(),
    /** Overrides for guest UI strings, keyed by `guest` namespace key. */
    uiTexts: z.record(z.string().min(1).max(200), LocalizedShortTextSchema).optional(),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    doc.blocks.forEach((block, index) => {
      if (seen.has(block.id)) {
        ctx.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: `Duplicate block id "${block.id}"` });
      }
      seen.add(block.id);
      if (block.type === 'notice' && block.preset === 'custom' && !block.text) {
        ctx.addIssue({ code: 'custom', path: ['blocks', index, 'text'], message: 'Custom notices need a text' });
      }
    });
  });
export type GuestMenuDocument = z.infer<typeof GuestMenuDocumentSchema>;

export function parseGuestMenuDocument(value: unknown): GuestMenuDocument {
  return GuestMenuDocumentSchema.parse(value);
}

export function safeParseGuestMenuDocument(value: unknown) {
  return GuestMenuDocumentSchema.safeParse(value);
}

let blockIdCounter = 0;
/** Short random id for new blocks (unique within a document). */
export function createBlockId(prefix = 'b'): string {
  blockIdCounter = (blockIdCounter + 1) % 1_000_000;
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${blockIdCounter.toString(36)}`;
}

export function createDefaultOutputs(): GuestMenuOutputs {
  return {
    web: {
      enabled: true,
      layout: 'list',
      fields: createDefaultOutputFieldOverrides('web'),
      search: { enabled: true, includeOnRequest: false, ingredientsSearchable: true },
      filters: { categories: 'auto', allergens: true, alcohol: true },
      sort: 'menu',
    },
    monitor: {
      enabled: true,
      layout: 'compact',
      fields: createDefaultOutputFieldOverrides('monitor'),
      columns: 'auto',
      pageDurationSeconds: 15,
      showQrCode: true,
      localeMode: 'primary',
      locale: null,
    },
    print: {
      enabled: true,
      layout: 'list',
      fields: createDefaultOutputFieldOverrides('print'),
      paper: 'A4',
      locale: null,
      showQrCode: true,
    },
  };
}

export interface CreateDefaultGuestMenuDocumentOptions {
  /** Content primary locale for the initial title. */
  locale?: string;
  title?: string;
  /** If true (default), add a `cardAllGroups` section – useful with a source card. */
  withCardSection?: boolean;
}

export function createDefaultGuestMenuDocument(options: CreateDefaultGuestMenuDocumentOptions = {}): GuestMenuDocument {
  const locale = options.locale ?? 'de';
  const blocks: Block[] = [{ id: createBlockId('header'), type: 'header', showLogo: true, showTitle: true, showSubtitle: true }];
  if (options.withCardSection ?? true) {
    blocks.push({ id: createBlockId('section'), type: 'section', title: {}, source: { kind: 'cardAllGroups' }, overrides: {} });
  }
  blocks.push({ id: createBlockId('notice'), type: 'notice', preset: 'allergens' });

  return {
    schemaVersion: GUEST_MENU_SCHEMA_VERSION,
    title: { [locale]: options.title ?? '' },
    theme: structuredClone(DEFAULT_THEME),
    templates: {
      web: { templateId: DEFAULT_TEMPLATE_ID.web },
      monitor: { templateId: DEFAULT_TEMPLATE_ID.monitor },
      print: { templateId: DEFAULT_TEMPLATE_ID.print },
    },
    outputs: createDefaultOutputs(),
    defaults: { fields: { ...DEFAULT_FIELD_CONFIG } },
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Public DTO (resolver output, the only data sent to guests)
// ---------------------------------------------------------------------------

export interface PublicThemeDto {
  preset: string;
  tokens: ThemeTokens;
  /** Map of CSS variables (`--gm-bg`, …) derived from the tokens. */
  cssVariables: Record<string, string>;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
}

export interface PublicTagDto {
  tag: string;
  /** Localized label, falls back to the raw tag. */
  label: string;
  categoryId: string | null;
  color: string | null;
}

export interface PublicTagCategoryDto {
  id: string;
  name: string;
  order: number;
  /** Tags of this category that occur in the menu, with item counts. */
  tags: (PublicTagDto & { count: number })[];
}

export interface PublicBadgeDto {
  kind: 'highlight' | 'alcoholFree' | 'unavailable' | 'onRequest';
  key: string;
  label: string;
}

export interface PublicAlcoholDto {
  /** % vol, rounded; `null` if unknown. */
  abv: number | null;
  /** Grams of pure alcohol per serving, if computable. */
  grams: number | null;
  status: AlcoholStatus;
  category: AlcoholCategory | null;
  alcoholFree: boolean;
  /** Calculated values are approximate ("ca."). */
  approximate: boolean;
}

export interface PublicAllergenDto {
  code: Allergen;
  /** Footnote letter (ALLERGEN_CODES). */
  short: string;
  label: string;
  /** Only via optional/alternative ingredients. */
  optional: boolean;
}

export interface PublicAdditiveDto {
  code: Additive;
  /** Footnote number (ADDITIVE_NUMBERS). */
  number: number;
  label: string;
  optional: boolean;
}

export interface PublicMenuItemDto {
  id: string;
  /** Localized name (translation → primary → raw). */
  name: string;
  /** Name in the content primary locale (search matches both). */
  nameOriginal: string;
  price: number | null;
  priceFormatted: string | null;
  ingredients?: { name: string; optional: boolean }[];
  /** Only present if `fields.amounts` is not `off`. */
  amounts?: { name: string; amount: number | null; unit: string | null; optional: boolean }[];
  /** Public tags only. */
  tags?: PublicTagDto[];
  badges?: PublicBadgeDto[];
  imageUrl?: string | null;
  description?: string | null;
  history?: string | null;
  glass?: { name: string } | null;
  garnishes?: { name: string; optional: boolean }[];
  rating?: { average: number; count: number } | null;
  alcohol?: PublicAlcoholDto;
  allergens?: PublicAllergenDto[];
  additives?: PublicAdditiveDto[];
  /** All involved ingredients/garnishes have `guestInfoComplete`. */
  guestInfoComplete?: boolean;
  /** `unavailableUntil > now` ("heute aus"): greyed out and sorted to the end. */
  unavailable: boolean;
  /** Found via search outside the menu (`search.includeOnRequest`). */
  onRequest: boolean;
  highlight: GuestMenuHighlight | null;
  /** Effective field config if it differs from the section's (item override). */
  fields?: FieldConfig;
  /**
   * Filter facets for the web shell (independent of field visibility). Only
   * present for `web`; each part only if the corresponding filter is enabled.
   */
  facets?: PublicItemFacetsDto;
  /** Search terms for the web shell (current + primary locale), only for `web`. */
  searchIndex?: PublicItemSearchIndexDto;
}

export interface PublicItemFacetsDto {
  /** Public tags (own + inherited from ingredients) that belong to a filter category. */
  tags: string[];
  alcoholCategory: AlcoholCategory | null;
  /** Allergens for "without X" filters; `null` = incomplete info (never matches "without"). */
  allergens: Allergen[] | null;
  price: number | null;
  /** Ids of matching custom filters (`outputs.web.filters.custom`). */
  custom?: string[];
}

export interface PublicCustomFilterDto {
  id: string;
  label: string;
  quick: boolean;
  /** Number of menu cocktails matching this filter. */
  count: number;
}

export interface PublicItemSearchIndexDto {
  /** Guest ingredient names in the current and primary locale (only if `search.ingredientsSearchable`). */
  ingredients: string[];
  /** Public tag labels (own + inherited from ingredients) in the current and primary locale. */
  tags: string[];
}

export interface PublicSectionDto {
  id: string;
  /** Expanded `cardAllGroups` sections get `${blockId}:${groupId}`. */
  sourceBlockId: string;
  title: string;
  description: string | null;
  layout: GuestMenuLayout;
  fields: FieldConfig;
  items: PublicMenuItemDto[];
}

export type PublicBlockDto =
  | { id: string; type: 'header'; showLogo: boolean; showTitle: boolean; showSubtitle: boolean }
  | ({ type: 'section' } & PublicSectionDto)
  | { id: string; type: 'text'; markdown: string }
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'notice'; preset: NoticePreset; markdown: string };

export interface PublicNoticeDto {
  key: NoticeTextKey | string;
  markdown: string;
}

export interface PublicMenuDto {
  menu: {
    id: string;
    slug: string;
    name: string;
    title: string;
    subtitle: string | null;
    workspaceName: string;
    workspaceSlug: string | null;
    publishedAt: string | null;
    updatedAt: string;
    /** Draft rendered via `?preview=<previewToken>`. */
    isPreview: boolean;
    /** Relative public URL of this menu (`/m/{bar}/{menuSlug}`). */
    publicPath: string;
  };
  output: GuestMenuOutput;
  /** Content locale used for this response. */
  locale: string;
  primaryLocale: string;
  availableLocales: string[];
  /** Guest UI language (de/en, fallback en). */
  uiLocale: 'de' | 'en';
  currency: string;
  theme: PublicThemeDto;
  layout: GuestMenuLayout;
  /** Output-level effective field config. */
  fields: FieldConfig;
  blocks: PublicBlockDto[];
  /** Web only: search/filter configuration. */
  search?: WebOutput['search'];
  filters: {
    tagCategories: PublicTagCategoryDto[];
    /** Custom filters with at least one matching cocktail. */
    custom?: PublicCustomFilterDto[];
    customTitle?: string | null;
    /** Allergens occurring in the menu (for "without X" filters). */
    allergens: Allergen[];
    alcoholCategories: AlcoholCategory[];
  };
  /** Legend for allergen/additive footnotes used in this response. */
  footnotes: {
    allergens: PublicAllergenDto[];
    additives: PublicAdditiveDto[];
  };
  notices: PublicNoticeDto[];
  /** Overrides for guest UI strings for the current locale. */
  uiTexts: Record<string, string>;
  /** Web only: the menu asks search engines not to index it (`outputs.web.noindex`). */
  noindex?: boolean;
  /** Monitor only: display settings from `outputs.monitor` (signage slides may override them). */
  monitor?: Pick<MonitorOutput, 'columns' | 'pageDurationSeconds' | 'showQrCode' | 'localeMode'>;
  /**
   * Web only (`search.includeOnRequest`): non-archived cocktails outside the
   * menu, `onRequest: true`; only shown as search results.
   */
  onRequestItems?: PublicMenuItemDto[];
}
