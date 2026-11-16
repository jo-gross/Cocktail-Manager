import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupImportSchema, findBackupReferenceIssues } from '@lib/backup/backupSchema';
import { DEFAULT_TAG_CATEGORIES } from '@lib/tags/defaultTagCategories';
import { listBuiltInTemplateKeys, loadBuiltInTemplate, readTemplateImage, resolveTemplateImages } from '@lib/templates/builtIn';
import { TemplateManifestSchema } from '@lib/templates/manifest';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

function templateDir() {
  const dir = mkdtempSync(join(tmpdir(), 'template-'));
  mkdirSync(join(dir, 'images'));
  writeFileSync(join(dir, 'images', 'lime.png'), PNG);
  writeFileSync(join(dir, 'images', 'logo.svg'), '<svg/>');
  writeFileSync(join(dir, 'secret.png'), PNG);
  return dir;
}

describe('TemplateManifestSchema', () => {
  it('accepts a manifest and applies defaults', () => {
    const manifest = TemplateManifestSchema.parse({ key: 'all-time-classics', kind: 'CATALOG', version: 1, name: { de: 'Klassiker' }, locales: ['de', 'en'] });
    expect(manifest).toMatchObject({ published: false, isDefault: false, sortOrder: 0 });
  });

  it.each([
    { key: 'Classics', kind: 'CATALOG', version: 1, name: { de: 'x' }, locales: ['de'] },
    { key: '../etc', kind: 'CATALOG', version: 1, name: { de: 'x' }, locales: ['de'] },
    { key: 'a', kind: 'OTHER', version: 1, name: { de: 'x' }, locales: ['de'] },
    { key: 'a', kind: 'BASE', version: 0, name: { de: 'x' }, locales: ['de'] },
    { key: 'a', kind: 'BASE', version: 1, name: {}, locales: ['de'] },
    { key: 'a', kind: 'BASE', version: 1, name: { de: 'x' }, locales: [] },
    { key: 'a', kind: 'BASE', version: 1, name: { de: 'x' }, locales: ['DE_de'] },
  ])('rejects %j', (manifest) => {
    expect(TemplateManifestSchema.safeParse(manifest).success).toBe(false);
  });
});

describe('template images', () => {
  it('resolves raster images of image fields to data URIs', () => {
    const dir = templateDir();
    const resolved = resolveTemplateImages(
      { garnishImages: [{ garnishId: 'x', image: 'file:images/lime.png' }], note: { description: 'file:images/lime.png' } },
      dir,
    ) as {
      garnishImages: Array<{ image: string }>;
      note: { description: string };
    };
    expect(resolved.garnishImages[0]!.image).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
    // Only image fields are resolved.
    expect(resolved.note.description).toBe('file:images/lime.png');
  });

  it.each([
    'file:images/../secret.png',
    'file:images/sub/lime.png',
    'file:/etc/passwd',
    'file:images/.hidden.png',
    'file:images/logo.svg',
    'file:images/missing.png',
  ])('rejects %s', (reference) => {
    expect(() => readTemplateImage(templateDir(), reference)).toThrow();
  });
});

describe('built-in templates in the repo', () => {
  it('are valid backups with valid manifests', () => {
    const keys = listBuiltInTemplateKeys();
    expect(keys).toContain('base');
    for (const key of keys) {
      const { manifest, backup } = loadBuiltInTemplate(key);
      expect(manifest.key).toBe(key);
      const parsed = BackupImportSchema.parse(backup);
      expect(findBackupReferenceIssues(parsed)).toEqual([]);
    }
  });

  it('base contains the former workspace defaults', () => {
    const { manifest, backup } = loadBuiltInTemplate('base');
    expect(manifest).toMatchObject({ kind: 'BASE', isDefault: true, published: true });
    const data = BackupImportSchema.parse(backup);
    expect(data.units.map((unit) => unit.name).sort()).toEqual(['BAR_SPOON', 'CL', 'DASH', 'DROPPER_CM', 'DROPPER_DROPS', 'GRAMM', 'PIECE', 'SPRAY']);
    expect(data.ice.map((ice) => ice.name).sort()).toEqual(['ICE_CRUSHED', 'ICE_CUBES', 'WITHOUT_ICE']);
    expect(data.stepActions).toHaveLength(11);
    expect(data.unitConversions).toHaveLength(6);
    expect(data.tagCategories?.map(({ name, order, showAsGuestFilter }) => ({ name, order, showAsGuestFilter }))).toEqual(DEFAULT_TAG_CATEGORIES);
    expect(data.workspaceSettings.map((setting) => setting.setting)).toEqual(['translations']);
  });
});
