/**
 * Design of guest menus that come with a template, chosen by the business type of the setup
 * wizard (`lib/onboarding/setupWizard.ts`, not persisted): built-in look per output plus its
 * theme tokens and suggested web layout. Pure module.
 */
import type { BackupImportData } from '@lib/backup/backupSchema';
import { BUSINESS_TYPES, type BusinessType } from '@lib/onboarding/setupWizard';
import { safeParseGuestMenuDocument, type GuestMenuDocument, type GuestMenuOutput } from '@lib/guest-menu/schema';
import { getBuiltInTemplate } from '@lib/guest-menu/templates';

export { BUSINESS_TYPES, type BusinessType };

/** Built-in template per output; the theme tokens and the web layout come from the `web` one. */
export const GUEST_MENU_DESIGN_BY_BUSINESS_TYPE: Record<BusinessType, Record<GuestMenuOutput, string>> = {
  // Dark, gold accents: evening bar.
  bar: { web: 'speakeasy', monitor: 'speakeasy', print: 'speakeasy' },
  // Calm serif menu, elegant print for the table.
  restaurant: { web: 'classic', monitor: 'classic', print: 'print-elegant' },
  // Image cards, good on phones and screens.
  event: { web: 'modern', monitor: 'modern', print: 'classic' },
  // Plain and light.
  private: { web: 'minimal', monitor: 'minimal', print: 'minimal' },
};

/** The document with the design of `businessType` (theme preset + tokens, templates, web layout); other settings stay. */
export function applyBusinessTypeDesign(document: GuestMenuDocument, businessType: BusinessType): GuestMenuDocument {
  const design = GUEST_MENU_DESIGN_BY_BUSINESS_TYPE[businessType];
  const web = getBuiltInTemplate(design.web);
  if (!web) return document;
  return {
    ...document,
    theme: { ...document.theme, preset: web.id, tokens: structuredClone(web.defaultTokens) },
    templates: {
      web: { templateId: design.web },
      monitor: { templateId: design.monitor },
      print: { templateId: design.print },
    },
    outputs: { ...document.outputs, web: { ...document.outputs.web, layout: web.layout } },
  };
}

function withDesign(value: unknown, businessType: BusinessType): unknown {
  if (value == null) return value;
  const parsed = safeParseGuestMenuDocument(value);
  // Invalid documents are reported by the import; they keep their content.
  return parsed.success ? applyBusinessTypeDesign(parsed.data, businessType) : value;
}

/** Pure: the guest menus of a template with the design of `businessType` (draft and published document); unchanged without one. */
export function withGuestMenuTheme(data: BackupImportData, businessType: BusinessType | undefined): BackupImportData {
  if (!businessType || !data.guestMenus?.length) return data;
  return {
    ...data,
    guestMenus: data.guestMenus.map((menu) => ({
      ...menu,
      draft: withDesign(menu.draft, businessType),
      published: menu.published == null ? menu.published : withDesign(menu.published, businessType),
    })),
  };
}
