import { describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma/client';
import { createDefaultGuestMenuDocument, GUEST_MENU_SCHEMA_VERSION } from '@lib/guest-menu/schema';
import {
  importedGuestMenuSafeState,
  normalizeBackupGuestMenuSlug,
  prepareBackupGuestMenuDocument,
  stripGuestMenuSecrets,
  validateBackupGuestMenuTemplate,
  validateBackupWorkspaceSetting,
} from '../backupSecurity';

const emptyMaps = { cocktails: new Map(), ingredients: new Map(), cardGroups: new Map(), templates: new Map() };

describe('stripGuestMenuSecrets', () => {
  it('removes access code hash/version and preview token, keeps everything else', () => {
    const menu = { id: 'm1', name: 'Abend', slug: 'abend', accessCodeHash: '$2b$hash', accessCodeVersion: 3, previewToken: 'secret', draft: {} };
    const stripped = stripGuestMenuSecrets(menu);
    expect(stripped).toEqual({ id: 'm1', name: 'Abend', slug: 'abend', draft: {} });
    expect(JSON.stringify(stripped)).not.toMatch(/accessCode|previewToken|secret|\$2b\$/);
    // Input is not mutated.
    expect(menu.previewToken).toBe('secret');
  });
});

describe('importedGuestMenuSafeState', () => {
  it('is disabled, unpublished, not default, without access code and with a fresh preview token', () => {
    const a = importedGuestMenuSafeState();
    const b = importedGuestMenuSafeState();
    expect(a).toMatchObject({ enabled: false, isDefault: false, publishedAt: null, accessCodeHash: null, accessCodeVersion: 0 });
    expect(a.published).toBe(Prisma.DbNull);
    expect(a.previewToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.previewToken).not.toBe(b.previewToken);
  });
});

describe('validateBackupWorkspaceSetting', () => {
  it('accepts valid settings and null values', () => {
    expect(validateBackupWorkspaceSetting({ setting: 'timezone', value: 'Europe/Berlin' })).toEqual({
      ok: true,
      value: { setting: 'timezone', value: 'Europe/Berlin' },
    });
    expect(validateBackupWorkspaceSetting({ setting: 'currency', value: null })).toEqual({ ok: true, value: { setting: 'currency', value: null } });
  });

  it('rejects invalid values and unknown keys', () => {
    expect(validateBackupWorkspaceSetting({ setting: 'timezone', value: 'Mars/Olympus' }).ok).toBe(false);
    expect(validateBackupWorkspaceSetting({ setting: 'currency', value: 'EURO' }).ok).toBe(false);
    expect(validateBackupWorkspaceSetting({ setting: 'contentLocales', value: '{"primary":"de","additional":["de"]}' }).ok).toBe(false);
    expect(validateBackupWorkspaceSetting({ setting: 'evil', value: 'x' }).ok).toBe(false);
    expect(validateBackupWorkspaceSetting({ setting: 'timezone', value: 42 }).ok).toBe(false);
  });
});

describe('validateBackupGuestMenuTemplate', () => {
  const definition = { schemaVersion: GUEST_MENU_SCHEMA_VERSION, baseTemplateId: 'classic', slots: { item: '<p>{{ item.name }}</p>' } };

  it('accepts a valid custom template', () => {
    const result = validateBackupGuestMenuTemplate({ name: '  Hausstil ', definition });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Hausstil');
  });

  it('rejects broken syntax, unknown base templates and malformed definitions', () => {
    expect(validateBackupGuestMenuTemplate({ name: 'x', definition: { ...definition, slots: { item: '{% if %}' } } }).ok).toBe(false);
    expect(validateBackupGuestMenuTemplate({ name: 'x', definition: { ...definition, baseTemplateId: 'nope' } }).ok).toBe(false);
    expect(validateBackupGuestMenuTemplate({ name: 'x', definition: { slots: 'x' } }).ok).toBe(false);
    expect(validateBackupGuestMenuTemplate({ name: '', definition }).ok).toBe(false);
  });
});

describe('prepareBackupGuestMenuDocument', () => {
  it('validates and remaps a valid document', () => {
    const document = createDefaultGuestMenuDocument({ withCardSection: false });
    document.blocks.push({ id: 's1', type: 'section', title: {}, source: { kind: 'manual', cocktailIds: ['old-c', 'gone'] }, overrides: {} } as never);
    const result = prepareBackupGuestMenuDocument(document, { ...emptyMaps, cocktails: new Map([['old-c', 'new-c']]) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const section = result.value.blocks.find((block) => block.id === 's1');
    expect(section).toMatchObject({ source: { kind: 'manual', cocktailIds: ['new-c'] } });
  });

  it('rejects invalid documents', () => {
    expect(prepareBackupGuestMenuDocument({}, emptyMaps).ok).toBe(false);
    expect(prepareBackupGuestMenuDocument(null, emptyMaps).ok).toBe(false);
    expect(prepareBackupGuestMenuDocument({ ...createDefaultGuestMenuDocument(), blocks: [{ type: 'script' }] }, emptyMaps).ok).toBe(false);
  });
});

describe('normalizeBackupGuestMenuSlug', () => {
  it('keeps valid slugs and normalizes invalid ones', () => {
    expect(normalizeBackupGuestMenuSlug('abendkarte')).toBe('abendkarte');
    expect(normalizeBackupGuestMenuSlug('../Admin Panel')).toBe('admin-panel');
    expect(normalizeBackupGuestMenuSlug('???')).toBe('menu');
    expect(normalizeBackupGuestMenuSlug(undefined)).toBe('menu');
  });
});
