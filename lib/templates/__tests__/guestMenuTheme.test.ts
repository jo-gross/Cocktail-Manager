import { describe, expect, it } from 'vitest';
import { BackupImportSchema } from '@lib/backup/backupSchema';
import { createDefaultGuestMenuDocument, safeParseGuestMenuDocument } from '@lib/guest-menu/schema';
import { getBuiltInTemplate } from '@lib/guest-menu/templates';
import { BUSINESS_TYPES, GUEST_MENU_DESIGN_BY_BUSINESS_TYPE, applyBusinessTypeDesign, withGuestMenuTheme } from '@lib/templates/guestMenuTheme';

describe('guest menu design by business type', () => {
  it('maps every business type to built-in templates', () => {
    for (const type of BUSINESS_TYPES) {
      for (const templateId of Object.values(GUEST_MENU_DESIGN_BY_BUSINESS_TYPE[type]))
        expect(getBuiltInTemplate(templateId), `${type}: ${templateId}`).toBeDefined();
    }
  });

  it('sets theme, templates and web layout and keeps the content', () => {
    const document = createDefaultGuestMenuDocument({ title: 'Karte' });
    const event = applyBusinessTypeDesign(document, 'event');
    expect(event.theme).toMatchObject({ preset: 'modern', tokens: getBuiltInTemplate('modern')!.defaultTokens });
    expect(event.templates).toEqual({ web: { templateId: 'modern' }, monitor: { templateId: 'modern' }, print: { templateId: 'classic' } });
    expect(event.outputs.web.layout).toBe('cards');
    expect(event.blocks).toEqual(document.blocks);
    expect(event.title).toEqual(document.title);
    expect(safeParseGuestMenuDocument(event).success).toBe(true);
    expect(applyBusinessTypeDesign(document, 'restaurant').templates.print.templateId).toBe('print-elegant');
  });

  it('applies to draft and published documents of a backup; invalid documents stay untouched', () => {
    const document = createDefaultGuestMenuDocument({ title: 'Karte' });
    const data = BackupImportSchema.parse({
      guestMenus: [
        { id: 'm1', name: 'Karte', draft: document, published: document },
        { id: 'm2', name: 'Kaputt', draft: { broken: true } },
      ],
    });
    expect(withGuestMenuTheme(data, undefined)).toBe(data);
    const [first, second] = withGuestMenuTheme(data, 'bar').guestMenus!;
    expect(first!.draft).toMatchObject({ theme: { preset: 'speakeasy' }, templates: { web: { templateId: 'speakeasy' } } });
    expect(first!.published).toMatchObject({ theme: { preset: 'speakeasy' } });
    expect(second!.draft).toEqual({ broken: true });
  });
});
