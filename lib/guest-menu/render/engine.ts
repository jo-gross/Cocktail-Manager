/**
 * Sandboxed Liquid engine for guest menu templates (liquidjs).
 *
 * - No file system: only the registered partials (lib/guest-menu/templates/partials.ts).
 * - `ownPropertyOnly`, parse/render/memory limits, output escaping by default
 *   (`{{ x }}` is HTML-escaped; HTML-producing filters below are marked raw,
 *   use `| raw` for anything else that is already HTML).
 * - Context = resolver output only (plain JSON clone).
 *
 * Filters:
 * - `money` – number → `Intl.NumberFormat(locale, { style: 'currency', currency })`
 * - `t` – guest UI text: `{{ 'badge.new' | t }}`, `{{ 'alcohol.percent' | t: value: 12 }}`
 *   (`guestInfo:` prefix for the guestInfo namespace; menu `uiTexts` overrides win)
 * - `markdown` – safe Markdown → HTML (raw)
 * - `join_names` – `[{ name }]` / strings → "a, b" (optional separator arg)
 * - `footnote_marks` – item → "A,G,(C),2" (allergen letters if `allergenDisplay` is
 *   `footnotes`, additive numbers; optional ones in parentheses). Optional args:
 *   `item | footnote_marks: includeAllergens, includeAdditives`
 * - `allergen_marks` – item → HTML per `allergenDisplay` (icons / codes / footnotes) (raw)
 * - `alcohol_label` – item → text per `alcoholDisplay` ("ca. 12 % vol", "leicht", …)
 */
import { Liquid, type FilterImplOptions } from 'liquidjs';
import type { AllergenDisplay, AlcoholDisplay, FieldConfig, PublicAlcoholDto, PublicAllergenDto, PublicAdditiveDto } from '../schema';
import { formatMoney } from '../format';
import { escapeHtml, markdownToHtml } from './markdown';

export { formatMoney };
import { translateGuestText, type GuestUiLocale } from './uiTexts';

export const LIQUID_LIMITS = {
  /** Max characters parsed per template (slot). */
  parseLimit: 200_000,
  /** Max milliseconds per render call (one slot for one item). */
  renderLimit: 500,
  /** Max allocated "memory units" per render call. */
  memoryLimit: 20_000_000,
} as const;

/** Max milliseconds for all render calls of one menu render (all slots and items together). */
export const MENU_RENDER_BUDGET_MS = 1500;

export interface LiquidRenderContextOptions {
  locale: string;
  uiLocale: GuestUiLocale;
  currency: string;
  uiTexts: Record<string, string>;
}

export interface TemplateError {
  slot: string;
  message: string;
  line: number | null;
  column: number | null;
}

/** Simple icons (emoji) per allergen for `allergenDisplay: icons`. */
export const ALLERGEN_ICONS: Record<string, string> = {
  GLUTEN: '🌾',
  CRUSTACEANS: '🦐',
  EGGS: '🥚',
  FISH: '🐟',
  PEANUTS: '🥜',
  SOY: '🫘',
  MILK: '🥛',
  NUTS: '🌰',
  CELERY: '🥬',
  MUSTARD: '🟡',
  SESAME: '⚪',
  SULPHITES: '🍷',
  LUPIN: '🌼',
  MOLLUSCS: '🐚',
};

type ScopeImpl = { context: { getSync: (paths: string[]) => unknown } };

type MarkItem = { allergens?: PublicAllergenDto[]; additives?: PublicAdditiveDto[]; alcohol?: PublicAlcoholDto; fields?: FieldConfig };

/** Liquid passes keyword args (`t: value: 1`) as `[key, value]` tuples and positional args as values. */
function collectArgs(args: unknown[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'string') {
      values[arg[0]] = arg[1];
    } else if (typeof arg === 'string' && i + 1 < args.length) {
      values[arg] = args[i + 1];
      i++;
    }
  }
  return values;
}

function formatNumber(value: number, locale: string, digits = 1): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  } catch {
    return String(Math.round(value * 10) / 10);
  }
}

export function footnoteMarks(
  item: MarkItem | null | undefined,
  allergenDisplay: AllergenDisplay | undefined,
  includeAllergens = true,
  includeAdditives = true,
): string {
  if (!item) return '';
  const marks: string[] = [];
  if (includeAllergens && allergenDisplay === 'footnotes') {
    for (const allergen of item.allergens ?? []) marks.push(allergen.optional ? `(${allergen.short})` : allergen.short);
  }
  if (includeAdditives) {
    for (const additive of item.additives ?? []) marks.push(additive.optional ? `(${additive.number})` : String(additive.number));
  }
  return marks.join(',');
}

export function allergenMarksHtml(item: MarkItem | null | undefined, display: AllergenDisplay | undefined, optionalLabel: string): string {
  const allergens = item?.allergens ?? [];
  if (allergens.length === 0) return '';
  const mode = display ?? 'icons';
  if (mode === 'icons') {
    const icons = allergens
      .map((allergen) => {
        const label = escapeHtml(allergen.optional ? `${allergen.label} (${optionalLabel})` : allergen.label);
        return `<span class="gm-allergen-icon${allergen.optional ? ' gm-allergen-icon--optional' : ''}" data-allergen="${allergen.code}" title="${label}" aria-label="${label}" role="img">${ALLERGEN_ICONS[allergen.code] ?? escapeHtml(allergen.short)}</span>`;
      })
      .join('');
    return `<span class="gm-allergens gm-allergens--icons">${icons}</span>`;
  }
  if (mode === 'codes') {
    const codes = allergens
      .map((allergen) => `<abbr title="${escapeHtml(allergen.label)}">${escapeHtml(allergen.optional ? `(${allergen.short})` : allergen.short)}</abbr>`)
      .join(', ');
    return `<span class="gm-allergens gm-allergens--codes">${codes}</span>`;
  }
  const marks = allergens.map((allergen) => (allergen.optional ? `(${allergen.short})` : allergen.short)).join(',');
  return `<sup class="gm-allergens gm-allergens--footnotes">${escapeHtml(marks)}</sup>`;
}

export function alcoholLabel(alcohol: PublicAlcoholDto | null | undefined, display: AlcoholDisplay | undefined, options: LiquidRenderContextOptions): string {
  if (!alcohol) return '';
  const t = (key: string, values?: Record<string, unknown>) => translateGuestText(key, options.uiLocale, values, options.uiTexts);
  const categoryLabel = alcohol.category ? t(`guestInfo:alcohol.category.${alcohol.category}`) : '';
  switch (display ?? 'category') {
    case 'badgeOnly':
      return alcohol.alcoholFree ? categoryLabel : '';
    case 'category':
      return categoryLabel;
    case 'percent':
    case 'percentAndGrams': {
      if (alcohol.abv == null) return categoryLabel;
      let text = t('alcohol.percent', { value: formatNumber(alcohol.abv, options.locale) });
      if (alcohol.approximate) text = t('alcohol.approx', { value: text });
      if (display === 'percentAndGrams' && alcohol.grams != null) text += ` · ${t('alcohol.grams', { value: formatNumber(alcohol.grams, options.locale, 0) })}`;
      return text;
    }
    default:
      return categoryLabel;
  }
}

/** Creates an engine bound to the response locale/currency. `partials` are the only loadable templates. */
export function createLiquidEngine(options: LiquidRenderContextOptions, partials: Record<string, string>): Liquid {
  const engine = new Liquid({
    templates: { ...partials },
    ownPropertyOnly: true,
    strictFilters: true,
    strictVariables: false,
    outputEscape: 'escape',
    jsTruthy: false,
    cache: false,
    relativeReference: false,
    greedy: false,
    ...LIQUID_LIMITS,
  });

  const fieldsFromScope = (impl: ScopeImpl): FieldConfig | undefined => {
    try {
      return impl.context.getSync(['fields']) as FieldConfig | undefined;
    } catch {
      return undefined;
    }
  };

  engine.registerFilter('money', (value: unknown) => formatMoney(value, options.locale, options.currency));
  engine.registerFilter('t', (key: unknown, ...args: unknown[]) => translateGuestText(String(key ?? ''), options.uiLocale, collectArgs(args), options.uiTexts));
  const markdownFilter: FilterImplOptions = { raw: true, handler: (value: unknown) => markdownToHtml(value == null ? '' : String(value)) };
  engine.registerFilter('markdown', markdownFilter);
  engine.registerFilter('join_names', (value: unknown, separator: unknown = ', ') => {
    if (!Array.isArray(value)) return value == null ? '' : String(value);
    return value
      .map((entry) =>
        entry && typeof entry === 'object'
          ? String((entry as { name?: unknown; label?: unknown }).name ?? (entry as { label?: unknown }).label ?? '')
          : String(entry ?? ''),
      )
      .filter((name) => name !== '')
      .join(String(separator));
  });
  // `item | footnote_marks` or `item | footnote_marks: show.allergens, show.additives`
  engine.registerFilter('footnote_marks', function (this: ScopeImpl, item: unknown, includeAllergens?: unknown, includeAdditives?: unknown) {
    const fields = (item as MarkItem | null)?.fields ?? fieldsFromScope(this);
    return footnoteMarks(item as MarkItem, fields?.allergenDisplay, includeAllergens !== false, includeAdditives !== false);
  });
  engine.registerFilter('allergen_marks', {
    raw: true,
    handler: function (this: ScopeImpl, item: unknown) {
      const fields = (item as MarkItem | null)?.fields ?? fieldsFromScope(this);
      return allergenMarksHtml(item as MarkItem, fields?.allergenDisplay, translateGuestText('item.optional', options.uiLocale, {}, options.uiTexts));
    },
  });
  engine.registerFilter('alcohol_label', function (this: ScopeImpl, item: unknown) {
    const fields = (item as MarkItem | null)?.fields ?? fieldsFromScope(this);
    return alcoholLabel((item as MarkItem | null)?.alcohol, fields?.alcoholDisplay, options);
  });

  return engine;
}

/** Normalizes liquidjs errors into `{ message, line, column }`. */
export function toTemplateError(slot: string, error: unknown): TemplateError {
  const e = error as { token?: { getPosition?: () => number[] }; message?: string; originalError?: Error; errors?: unknown[] };
  if (Array.isArray(e?.errors) && e.errors.length > 0) return toTemplateError(slot, e.errors[0]);
  let line: number | null = null;
  let column: number | null = null;
  try {
    const position = e?.token?.getPosition?.();
    if (position) [line, column] = position;
  } catch {
    // ignore
  }
  if (line == null) {
    const match = /line:(\d+), col:(\d+)/.exec(e?.message ?? '');
    if (match) {
      line = Number(match[1]);
      column = Number(match[2]);
    }
  }
  const message = (e?.message ?? String(error)).split('\n')[0].replace(/, line:\d+, col:\d+/, '');
  return { slot, message, line, column };
}
