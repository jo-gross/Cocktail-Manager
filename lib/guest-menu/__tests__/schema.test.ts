import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD_CONFIG,
  DEFAULT_FIELD_CONFIG_BY_OUTPUT,
  FIELD_KEYS,
  GUEST_MENU_OUTPUTS,
  GuestMenuDocumentSchema,
  createDefaultGuestMenuDocument,
  isBlockVisibleInOutput,
  parseGuestMenuDocument,
  resolveFieldConfig,
  safeParseGuestMenuDocument,
  type GuestMenuDocument,
} from '../schema';
import { resolveLocalizedText } from '../localizedText';

describe('createDefaultGuestMenuDocument', () => {
  it('produces a document that passes the schema', () => {
    const doc = createDefaultGuestMenuDocument({ locale: 'en', title: 'Drinks' });
    expect(() => parseGuestMenuDocument(doc)).not.toThrow();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.title).toEqual({ en: 'Drinks' });
  });

  it('has header, card section and allergen notice by default', () => {
    const doc = createDefaultGuestMenuDocument();
    expect(doc.blocks.map((b) => b.type)).toEqual(['header', 'section', 'notice']);
    const section = doc.blocks[1];
    expect(section.type === 'section' && section.source.kind).toBe('cardAllGroups');
  });

  it('can omit the card section', () => {
    const doc = createDefaultGuestMenuDocument({ withCardSection: false });
    expect(doc.blocks.some((b) => b.type === 'section')).toBe(false);
  });

  it('generates unique block ids', () => {
    const doc = createDefaultGuestMenuDocument();
    const ids = doc.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not share mutable state between documents', () => {
    const a = createDefaultGuestMenuDocument();
    const b = createDefaultGuestMenuDocument();
    a.theme.tokens.colors.bg = '#000000';
    a.defaults.fields.price = 'off';
    a.outputs.web.fields.image = 'off';
    expect(b.theme.tokens.colors.bg).not.toBe('#000000');
    expect(b.defaults.fields.price).toBe('list');
    expect(b.outputs.web.fields.image).toBeUndefined();
    expect(resolveFieldConfig(b, 'web').image).toBe('list');
    expect(DEFAULT_FIELD_CONFIG.price).toBe('list');
  });
});

describe('field config defaults', () => {
  it('stores only per-output overrides so defaults.fields is inherited', () => {
    const doc = createDefaultGuestMenuDocument();
    expect(doc.outputs.web.fields).toEqual({});
    expect(doc.outputs.monitor.fields.image).toBe('off');
    expect(doc.outputs.monitor.fields.price).toBeUndefined();
    doc.defaults.fields.price = 'off';
    doc.defaults.fields.image = 'detail';
    for (const output of GUEST_MENU_OUTPUTS) expect(resolveFieldConfig(doc, output).price).toBe('off');
    expect(resolveFieldConfig(doc, 'web').image).toBe('detail');
    expect(resolveFieldConfig(doc, 'monitor').image).toBe('off');
    for (const output of GUEST_MENU_OUTPUTS) {
      expect(resolveFieldConfig(createDefaultGuestMenuDocument(), output)).toEqual(DEFAULT_FIELD_CONFIG_BY_OUTPUT[output]);
    }
  });

  it('covers every field key', () => {
    for (const key of FIELD_KEYS) {
      expect(DEFAULT_FIELD_CONFIG[key]).toBeDefined();
    }
  });

  it('never shows amounts by default in any output', () => {
    expect(DEFAULT_FIELD_CONFIG.amounts).toBe('off');
    for (const output of GUEST_MENU_OUTPUTS) {
      expect(DEFAULT_FIELD_CONFIG_BY_OUTPUT[output].amounts).toBe('off');
      expect(resolveFieldConfig(createDefaultGuestMenuDocument(), output).amounts).toBe('off');
    }
  });

  it('uses footnotes for allergens on print', () => {
    expect(resolveFieldConfig(createDefaultGuestMenuDocument(), 'print').allergenDisplay).toBe('footnotes');
  });
});

describe('resolveFieldConfig', () => {
  it('inherits defaults → output → section → override, ignoring undefined', () => {
    const doc = createDefaultGuestMenuDocument();
    doc.outputs.web.fields = { image: 'off' };
    const resolved = resolveFieldConfig(doc, 'web', { description: 'list', image: undefined }, { amounts: 'detail' });
    expect(resolved.image).toBe('off');
    expect(resolved.description).toBe('list');
    expect(resolved.amounts).toBe('detail');
    expect(resolved.price).toBe(DEFAULT_FIELD_CONFIG.price);
  });

  it('skips null layers', () => {
    const doc = createDefaultGuestMenuDocument();
    expect(resolveFieldConfig(doc, 'monitor', null, undefined)).toEqual(DEFAULT_FIELD_CONFIG_BY_OUTPUT.monitor);
  });
});

describe('GuestMenuDocumentSchema', () => {
  const base = (): GuestMenuDocument => createDefaultGuestMenuDocument({ withCardSection: false });

  it('accepts all block types and section sources', () => {
    const doc = base();
    doc.subtitle = { de: 'Sommer' };
    doc.noticeTexts = { allergens: { de: 'Fragen Sie uns' } };
    doc.uiTexts = { searchPlaceholder: { de: 'Suchen…', en: 'Search…' } };
    doc.blocks.push(
      { id: 's1', type: 'section', title: { de: 'Klassiker' }, source: { kind: 'cardGroup', groupId: 'g1' }, overrides: {} },
      {
        id: 's2',
        type: 'section',
        title: { de: 'Auswahl' },
        source: { kind: 'manual', cocktailIds: ['c1', 'c2'] },
        layout: 'grid',
        fields: { image: 'off' },
        overrides: { c1: { highlight: 'signature', price: 9.5, description: { de: 'Hausmarke' }, fields: { amounts: 'list' } }, c2: { hidden: true } },
        outputs: { print: false },
      },
      { id: 's3', type: 'section', title: {}, source: { kind: 'rule', tags: ['sour'], ingredientIds: [], logic: 'OR', sort: 'name' }, overrides: {} },
      { id: 't1', type: 'text', content: { de: '**Hallo**' } },
      { id: 'i1', type: 'image', src: 'https://example.com/a.png', alt: { de: 'Bild' } },
      { id: 'd1', type: 'divider' },
      { id: 'n1', type: 'notice', preset: 'custom', text: { de: 'Nur heute' } },
    );
    const result = safeParseGuestMenuDocument(doc);
    expect(result.success).toBe(true);
  });

  it('rejects unknown schema versions', () => {
    expect(safeParseGuestMenuDocument({ ...base(), schemaVersion: 2 }).success).toBe(false);
  });

  it('rejects duplicate block ids', () => {
    const doc = base();
    doc.blocks.push({ id: 'x', type: 'divider' }, { id: 'x', type: 'divider' });
    const result = GuestMenuDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('Duplicate block id');
  });

  it('requires a text for custom notices', () => {
    const doc = base();
    doc.blocks.push({ id: 'n', type: 'notice', preset: 'custom' });
    expect(safeParseGuestMenuDocument(doc).success).toBe(false);
  });

  it('rejects invalid colors, fonts and field modes', () => {
    const badColor = base();
    badColor.theme.tokens.colors.bg = 'red';
    expect(safeParseGuestMenuDocument(badColor).success).toBe(false);

    const badFont = base() as unknown as { theme: { tokens: { fontBody: string } } };
    badFont.theme.tokens.fontBody = 'comic-sans';
    expect(safeParseGuestMenuDocument(badFont).success).toBe(false);

    const badMode = base() as unknown as { outputs: { web: { fields: Record<string, string> } } };
    badMode.outputs.web.fields.price = 'sometimes';
    expect(safeParseGuestMenuDocument(badMode).success).toBe(false);
  });

  it('rejects invalid locale keys in LocalizedText', () => {
    const doc = base() as unknown as { title: Record<string, string> };
    doc.title = { 'Not A Locale': 'x' };
    expect(safeParseGuestMenuDocument(doc).success).toBe(false);
  });

  it('validates monitor/print options', () => {
    const doc = base();
    doc.outputs.monitor.columns = 3;
    doc.outputs.print.paper = 'DL';
    expect(safeParseGuestMenuDocument(doc).success).toBe(true);
    (doc.outputs.monitor as { columns: unknown }).columns = 12;
    expect(safeParseGuestMenuDocument(doc).success).toBe(false);
  });

  it('survives a JSON round trip (as stored in Prisma Json)', () => {
    const doc = createDefaultGuestMenuDocument({ title: 'Karte' });
    expect(parseGuestMenuDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});

describe('helpers', () => {
  it('isBlockVisibleInOutput treats undefined as visible', () => {
    expect(isBlockVisibleInOutput({ outputs: undefined }, 'web')).toBe(true);
    expect(isBlockVisibleInOutput({ outputs: { web: false } }, 'web')).toBe(false);
    expect(isBlockVisibleInOutput({ outputs: { web: false } }, 'print')).toBe(true);
  });

  it('resolveLocalizedText falls back locale → base → primary → any → fallback', () => {
    expect(resolveLocalizedText({ de: 'Hallo', en: 'Hello' }, 'en', 'de')).toBe('Hello');
    expect(resolveLocalizedText({ de: 'Hallo', pt: 'Olá' }, 'pt-BR', 'de')).toBe('Olá');
    expect(resolveLocalizedText({ de: 'Hallo', en: '' }, 'en', 'de')).toBe('Hallo');
    expect(resolveLocalizedText({ fr: 'Salut' }, 'en', 'de')).toBe('Salut');
    expect(resolveLocalizedText(undefined, 'en', 'de', 'raw')).toBe('raw');
  });
});
