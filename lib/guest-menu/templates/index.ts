/**
 * Built-in template registry + template resolution.
 *
 * Effective template for an output = built-in base (`templateId`, or the
 * custom template's `baseTemplateId`) ← custom template slots
 * (`custom:<GuestMenuTemplate.id>`) ← per-menu slot overrides (`document.templates[output].slots`).
 */
import { CUSTOM_TEMPLATE_PREFIX, TEMPLATE_SLOTS, type GuestMenuOutput, type GuestMenuTemplateDefinition, type TemplateRef, type TemplateSlot } from '../schema';
import { BASE_CSS, type BuiltInTemplate } from './base';
import { classicTemplate } from './classic';
import { minimalTemplate } from './minimal';
import { modernTemplate } from './modern';
import { monitorCompactTemplate } from './monitorCompact';
import { printElegantTemplate } from './printElegant';
import { speakeasyTemplate } from './speakeasy';

export type { BuiltInTemplate } from './base';
export { BASE_CSS } from './base';
export { GUEST_MENU_PARTIALS } from './partials';

export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  classicTemplate,
  modernTemplate,
  minimalTemplate,
  speakeasyTemplate,
  monitorCompactTemplate,
  printElegantTemplate,
];

export const DEFAULT_BUILT_IN_TEMPLATE_ID = classicTemplate.id;

export function getBuiltInTemplate(id: string | null | undefined): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.id === id);
}

/** Metadata for template pickers (no Liquid/CSS sources). */
export interface BuiltInTemplateInfo {
  id: string;
  name: string;
  description: string;
  outputs: GuestMenuOutput[];
  layout: BuiltInTemplate['layout'];
  defaultTokens: BuiltInTemplate['defaultTokens'];
}

export function listBuiltInTemplates(): BuiltInTemplateInfo[] {
  return BUILT_IN_TEMPLATES.map(({ id, name, description, outputs, layout, defaultTokens }) => ({ id, name, description, outputs, layout, defaultTokens }));
}

/** Fully resolved slots + CSS for rendering. */
export interface ResolvedTemplate {
  /** `templateId` as referenced (built-in id or `custom:<id>`). */
  id: string;
  baseTemplateId: string;
  slots: Record<TemplateSlot, string>;
  /** Unscoped CSS: base CSS + template CSS (+ custom template CSS + menu override CSS). */
  css: string;
  /** Slots that are not the built-in source (need validation on publish). */
  customizedSlots: TemplateSlot[];
}

export function isCustomTemplateId(templateId: string): boolean {
  return templateId.startsWith(CUSTOM_TEMPLATE_PREFIX);
}

export function getCustomTemplateDbId(templateId: string): string | null {
  return isCustomTemplateId(templateId) ? templateId.slice(CUSTOM_TEMPLATE_PREFIX.length) : null;
}

/**
 * @param ref document `templates[output]`
 * @param customTemplates workspace templates by DB id (only needed for `custom:` refs)
 */
export function resolveTemplate(
  ref: TemplateRef | null | undefined,
  customTemplates?: ReadonlyMap<string, GuestMenuTemplateDefinition> | null,
): ResolvedTemplate {
  const templateId = ref?.templateId ?? DEFAULT_BUILT_IN_TEMPLATE_ID;
  const customId = getCustomTemplateDbId(templateId);
  const custom = customId ? (customTemplates?.get(customId) ?? null) : null;
  const base = getBuiltInTemplate(custom ? custom.baseTemplateId : templateId) ?? classicTemplate;

  const slots = { ...base.slots };
  const customizedSlots = new Set<TemplateSlot>();
  const cssParts = [BASE_CSS, base.css];

  for (const layer of [custom?.slots, ref?.slots]) {
    if (!layer) continue;
    for (const slot of TEMPLATE_SLOTS) {
      const source = layer[slot];
      if (typeof source === 'string' && source.trim() !== '') {
        slots[slot] = source;
        customizedSlots.add(slot);
      }
    }
    if (layer.css && layer.css.trim() !== '') cssParts.push(layer.css);
  }

  return { id: templateId, baseTemplateId: base.id, slots, css: cssParts.join('\n'), customizedSlots: [...customizedSlots] };
}
