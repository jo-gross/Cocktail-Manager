/**
 * Renders a resolved `PublicMenuDto` with a (built-in or custom) Liquid template
 * into sanitized HTML slots + scoped CSS. Isomorphic (server: publish/preview/
 * public API; client: builder live preview).
 *
 *   const template = resolveTemplate(document.templates[output], customTemplates);
 *   const rendered = renderMenuSlots(dto, template, output);
 *   // → { css, rootAttributes, menuHeader, sections, blocks, footer, onRequestItems, errors }
 *
 * The React `GuestMenuShell` (components/guest-menu/shell) or `composeMenuHtml`
 * (static HTML for print/monitor) put the slots into the DOM contract
 * documented in lib/guest-menu/templates/base.ts.
 */
import type { Liquid, Template } from 'liquidjs';
import {
  FIELD_KEYS,
  TEMPLATE_SLOTS,
  type FieldConfig,
  type FieldKey,
  type GuestMenuOutput,
  type PublicBlockDto,
  type PublicMenuDto,
  type PublicMenuItemDto,
  type PublicSectionDto,
  type TemplateSlot,
} from '../schema';
import { GUEST_MENU_PARTIALS, type ResolvedTemplate } from '../templates';
import { createLiquidEngine, LIQUID_LIMITS, MENU_RENDER_BUDGET_MS, toTemplateError, type TemplateError } from './engine';
import { cssVariablesToDeclarations, getScopeSelector, scopeCss, type CssIssue } from './css';
import { escapeHtml, markdownToHtml } from './markdown';
import { sanitizeHtml } from './sanitize';
import { isSafeRelativeUrl } from './urlPolicy';
import { toGuestUiLocale } from './uiTexts';

export type { TemplateError } from './engine';
export type { CssIssue } from './css';

export interface RenderedItem {
  id: string;
  /** `item` slot (sanitized). */
  html: string;
  /** `item_detail` slot (sanitized); empty for monitor/print. */
  detailHtml: string;
}

export interface RenderedSection {
  id: string;
  /** `section_header` slot (sanitized). */
  header: string;
  layout: string;
  items: RenderedItem[];
}

export type RenderedBlock =
  | { id: string; type: 'header'; html: string }
  | { id: string; type: 'section'; sectionId: string }
  | { id: string; type: 'text' | 'image' | 'divider' | 'notice'; html: string };

export interface RenderedMenu {
  /** Scope selector, e.g. `.gm-root[data-gm="menuId"]`. */
  scope: string;
  /** Attributes for the root element (`class="gm-root"`, `data-gm`, …). */
  rootAttributes: Record<string, string>;
  /** Scoped CSS: theme variables + base/template CSS + custom theme CSS. */
  css: string;
  /** `menu_header` slot for the first visible header block ('' if none). */
  menuHeader: string;
  sections: RenderedSection[];
  /** All visible blocks in document order (sections reference `sections` by id). */
  blocks: RenderedBlock[];
  footer: string;
  /** Rendered on-request items (web search only). */
  onRequestItems: RenderedItem[];
  /** Liquid errors (slot + line); failing slots render as ''. */
  errors: TemplateError[];
  /** CSS syntax errors (template CSS / custom CSS). */
  cssErrors: (CssIssue & { source: 'template' | 'custom' })[];
}

export interface RenderMenuOptions {
  /** Override the scope id (default `dto.menu.id`). */
  scopeId?: string;
  /** Raw custom CSS from `document.theme.customCss` (scoped like template CSS). */
  customCss?: string | null;
  /** Stop after the first error per slot (publish validation) – default false. */
  failFast?: boolean;
  /**
   * Wall-clock budget (ms) shared by all slots/items of this render (default
   * `MENU_RENDER_BUDGET_MS`). Once exhausted, the remaining slots render as ''
   * and a `render` error is recorded (→ publish validation fails).
   */
  budgetMs?: number;
}

/** Monitor and print have no detail view: `detail` → off, `expandable` → list. */
function effectiveMode(mode: FieldConfig[FieldKey], output: GuestMenuOutput): FieldConfig[FieldKey] {
  if (output === 'web') return mode;
  if (mode === 'detail') return 'off';
  if (mode === 'expandable') return 'list';
  return mode;
}

function buildVisibility(fields: FieldConfig, output: GuestMenuOutput, slot: 'item' | 'item_detail') {
  const show: Record<string, boolean> = {};
  const expand: Record<string, boolean> = { any: false };
  for (const key of FIELD_KEYS) {
    const mode = effectiveMode(fields[key], output);
    if (slot === 'item_detail') {
      show[key] = mode !== 'off';
      expand[key] = false;
    } else {
      show[key] = mode === 'list';
      expand[key] = mode === 'expandable';
      if (expand[key]) expand.any = true;
    }
  }
  return { show, expand };
}

/** Plain JSON clone: the Liquid context must never contain prototypes/functions. */
function plain<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

class SlotRenderer {
  readonly errors: TemplateError[] = [];
  private readonly compiled = new Map<TemplateSlot, Template[] | null>();
  private readonly deadline: number;
  private budgetExceeded = false;

  constructor(
    private readonly engine: Liquid,
    private readonly template: ResolvedTemplate,
    private readonly budgetMs: number,
  ) {
    this.deadline = Date.now() + budgetMs;
  }

  /** Remaining wall-clock budget of the whole menu render; records one error once exhausted. */
  private remaining(): number {
    const remaining = this.deadline - Date.now();
    if (remaining > 0) return remaining;
    if (!this.budgetExceeded) {
      this.budgetExceeded = true;
      this.errors.push({
        slot: 'render',
        message: `Render time budget of ${this.budgetMs} ms exceeded – the remaining content was skipped`,
        line: null,
        column: null,
      });
    }
    return 0;
  }

  private compile(slot: TemplateSlot): Template[] | null {
    if (!this.compiled.has(slot)) {
      try {
        this.compiled.set(slot, this.engine.parse(this.template.slots[slot] ?? ''));
      } catch (error) {
        this.errors.push(toTemplateError(slot, error));
        this.compiled.set(slot, null);
      }
    }
    return this.compiled.get(slot) ?? null;
  }

  render(slot: TemplateSlot, scope: Record<string, unknown>): string {
    const remaining = this.remaining();
    if (remaining <= 0) return '';
    const compiled = this.compile(slot);
    if (!compiled) return '';
    try {
      const renderLimit = Math.max(1, Math.min(LIQUID_LIMITS.renderLimit, Math.ceil(remaining)));
      return sanitizeHtml(String(this.engine.renderSync(compiled, scope, { renderLimit })));
    } catch (error) {
      const templateError = toTemplateError(slot, error);
      if (!this.errors.some((e) => e.slot === templateError.slot && e.message === templateError.message && e.line === templateError.line)) {
        this.errors.push(templateError);
      }
      return '';
    }
  }
}

function renderStaticBlock(block: PublicBlockDto): string {
  switch (block.type) {
    case 'text':
      return sanitizeHtml(`<div class="gm-text">${markdownToHtml(block.markdown)}</div>`);
    case 'notice':
      return sanitizeHtml(`<aside class="gm-notice gm-notice--${escapeHtml(block.preset)}">${markdownToHtml(block.markdown)}</aside>`);
    case 'image':
      return sanitizeHtml(`<figure class="gm-image"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" loading="lazy"></figure>`);
    case 'divider':
      return '<hr class="gm-divider">';
    default:
      return '';
  }
}

export function renderMenuSlots(
  dto: PublicMenuDto,
  template: ResolvedTemplate,
  output: GuestMenuOutput = dto.output,
  options: RenderMenuOptions = {},
): RenderedMenu {
  const scopeId = options.scopeId ?? dto.menu.id;
  const scope = getScopeSelector(scopeId);
  const uiLocale = dto.uiLocale ?? toGuestUiLocale(dto.locale);
  const engine = createLiquidEngine({ locale: dto.locale, uiLocale, currency: dto.currency, uiTexts: dto.uiTexts ?? {} }, GUEST_MENU_PARTIALS);
  const renderer = new SlotRenderer(engine, template, options.budgetMs ?? MENU_RENDER_BUDGET_MS);

  const globals = plain({
    menu: dto.menu,
    theme: { preset: dto.theme.preset, logoUrl: dto.theme.logoUrl, backgroundImageUrl: dto.theme.backgroundImageUrl },
    output,
    locale: dto.locale,
    ui_locale: uiLocale,
    layout: dto.layout,
    currency: dto.currency,
    footnotes: dto.footnotes,
    notices: dto.notices,
  });

  const renderItem = (item: PublicMenuItemDto, section: Omit<PublicSectionDto, 'items'> | null, sectionFields: FieldConfig): RenderedItem => {
    const fields = item.fields ?? sectionFields;
    const itemData = plain(item);
    const sectionData = section ? plain(section) : null;
    const listScope = { ...globals, item: itemData, section: sectionData, fields, ...buildVisibility(fields, output, 'item') };
    const html = renderer.render('item', listScope);
    const detailHtml =
      output === 'web'
        ? renderer.render('item_detail', { ...globals, item: itemData, section: sectionData, fields, ...buildVisibility(fields, output, 'item_detail') })
        : '';
    return { id: item.id, html, detailHtml };
  };

  const sections: RenderedSection[] = [];
  const blocks: RenderedBlock[] = [];
  let menuHeader = '';

  for (const block of dto.blocks) {
    if (block.type === 'header') {
      const html = renderer.render('menu_header', { ...globals, header: plain(block) });
      if (!menuHeader) menuHeader = html;
      blocks.push({ id: block.id, type: 'header', html });
    } else if (block.type === 'section') {
      const { items, ...sectionMeta } = block;
      const sectionData = { ...sectionMeta, itemCount: items.length };
      const header = renderer.render('section_header', { ...globals, section: plain(sectionData), fields: block.fields });
      sections.push({ id: block.id, header, layout: block.layout, items: items.map((item) => renderItem(item, sectionData, block.fields)) });
      blocks.push({ id: block.id, type: 'section', sectionId: block.id });
    } else {
      blocks.push({ id: block.id, type: block.type, html: renderStaticBlock(block) });
    }
  }

  const footer = renderer.render('footer', globals);
  const onRequestItems = (dto.onRequestItems ?? []).map((item) => renderItem(item, null, item.fields ?? dto.fields));

  // CSS: variables + template CSS + custom CSS, each scoped.
  const cssErrors: RenderedMenu['cssErrors'] = [];
  const templateCss = scopeCss(template.css, scope);
  templateCss.errors.forEach((error) => cssErrors.push({ ...error, source: 'template' }));
  const customCss = scopeCss(options.customCss ?? null, scope);
  customCss.errors.forEach((error) => cssErrors.push({ ...error, source: 'custom' }));
  const variables = cssVariablesToDeclarations(dto.theme.cssVariables);
  const background =
    dto.theme.backgroundImageUrl && isSafeRelativeUrl(dto.theme.backgroundImageUrl)
      ? `;background-image:url("${dto.theme.backgroundImageUrl}");background-size:cover;background-attachment:fixed`
      : '';
  const css = [`${scope}{${variables}${background}}`, templateCss.css, customCss.css].filter(Boolean).join('\n');

  return {
    scope,
    rootAttributes: {
      class: 'gm-root',
      'data-gm': scopeId,
      'data-output': output,
      'data-layout': dto.layout,
      'data-template': template.id,
      lang: dto.locale,
    },
    css,
    menuHeader,
    sections,
    blocks,
    footer,
    onRequestItems,
    errors: renderer.errors,
    cssErrors,
  };
}

/** Validates all slots of a template by parsing them (no rendering). */
export function validateTemplateSyntax(template: ResolvedTemplate): TemplateError[] {
  const engine = createLiquidEngine({ locale: 'en', uiLocale: 'en', currency: 'EUR', uiTexts: {} }, GUEST_MENU_PARTIALS);
  const errors: TemplateError[] = [];
  for (const slot of TEMPLATE_SLOTS) {
    try {
      engine.parse(template.slots[slot] ?? '');
    } catch (error) {
      errors.push(toTemplateError(slot, error));
    }
  }
  const css = scopeCss(template.css, '.gm-root');
  for (const error of css.errors) errors.push({ slot: 'css', message: error.message, line: error.line, column: error.column });
  return errors;
}

function attributesToString(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
}

/**
 * Static HTML (no shell, no interactivity) following the DOM contract – for
 * print/PDF, monitor slides and no-JS fallbacks. Includes the `<style>` tag.
 */
export function composeMenuHtml(rendered: RenderedMenu, options: { includeStyle?: boolean } = {}): string {
  const sectionById = new Map(rendered.sections.map((section) => [section.id, section]));
  const body = rendered.blocks
    .map((block) => {
      if (block.type === 'header') return `<div class="gm-menu-header" data-block-id="${escapeHtml(block.id)}">${block.html}</div>`;
      if (block.type === 'section') {
        const section = sectionById.get(block.sectionId);
        if (!section) return '';
        const items = section.items.map((item) => `<div class="gm-item-wrap" data-item-id="${escapeHtml(item.id)}">${item.html}</div>`).join('');
        return `<section class="gm-section" id="gm-section-${escapeHtml(section.id)}" data-section-id="${escapeHtml(section.id)}"><div class="gm-section-header">${section.header}</div><div class="gm-items" data-layout="${escapeHtml(section.layout)}">${items}</div></section>`;
      }
      return `<div class="gm-block gm-block--${block.type}" data-block-id="${escapeHtml(block.id)}">${block.html}</div>`;
    })
    .join('');
  const style = options.includeStyle === false ? '' : `<style>${rendered.css.replace(/<\/style/gi, '<\\/style')}</style>`;
  return `${style}<div ${attributesToString(rendered.rootAttributes)}>${body}<div class="gm-menu-footer">${rendered.footer}</div></div>`;
}
