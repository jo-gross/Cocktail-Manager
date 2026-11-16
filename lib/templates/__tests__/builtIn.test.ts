import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupImportSchema, findBackupReferenceIssues } from '@lib/backup/backupSchema';
import { DEFAULT_TAG_CATEGORIES } from '@lib/tags/defaultTagCategories';
import {
  TEMPLATES_DIR,
  listBuiltInTemplateKeys,
  loadBuiltInTemplate,
  readBuiltInManifest,
  readTemplateImage,
  resolveTemplateImages,
} from '@lib/templates/builtIn';
import { builtInImageCredits, resolveImageCredits } from '@lib/templates/credits';
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

  it('all-time-classics is a de/en catalog without prices and with a credit for every image', () => {
    const { manifest, backup } = loadBuiltInTemplate('all-time-classics');
    expect(manifest).toMatchObject({ kind: 'CATALOG', locales: ['de', 'en'], published: true, version: expect.any(Number) });
    expect(manifest.source).toContain('IBA');
    const data = BackupImportSchema.parse(backup);
    expect({
      glasses: data.glass.length,
      ingredients: data.ingredient.length,
      garnishes: data.garnish.length,
      cocktails: data.cocktailRecipe.length,
      cards: data.cocktailCard.length,
    }).toEqual({ glasses: 10, ingredients: 45, garnishes: 15, cocktails: 22, cards: 1 });
    // The card holds every cocktail exactly once.
    expect(data.cocktailCardGroupItem.map((item) => item.cocktailId).sort()).toEqual(data.cocktailRecipe.map((row) => row.id).sort());
    expect([...data.ingredient, ...data.garnish, ...data.cocktailRecipe].every((row) => row.price === null)).toBe(true);
    expect([...data.ingredient, ...data.garnish].every((row) => row.guestInfoComplete === false)).toBe(true);
    // Every text has its English translation.
    expect(data.cocktailRecipeTranslations?.filter((row) => row.locale === 'en' && row.name && row.description && row.history)).toHaveLength(22);
    expect(data.ingredientTranslations?.filter((row) => row.locale === 'en' && row.name)).toHaveLength(45);
    // Tags: every used tag has a definition in a default category.
    const defined = new Set(data.tagDefinitions?.map((row) => row.tag));
    expect([...data.ingredient, ...data.cocktailRecipe].flatMap((row) => row.tags).filter((tag) => !defined.has(tag))).toEqual([]);
    const defaultNames = DEFAULT_TAG_CATEGORIES.map((category) => category.name);
    expect(data.tagCategories?.every((category) => defaultNames.some((name) => name.de === category.name?.de && name.en === category.name?.en))).toBe(true);

    const raw = JSON.parse(readFileSync(join(TEMPLATES_DIR, 'all-time-classics', 'backup.json'), 'utf-8')) as Record<string, unknown>;
    const credits = resolveImageCredits(raw, manifest.attributions ?? {});
    expect(credits.cocktail.size).toBe(22);
    expect(credits.glass.size).toBe(9);
    expect(credits.cocktail.get('Negroni')).toContain('Desdealbert00');
    expect(credits.cocktail.get('Old Fashioned')).toContain('© Erich Wagner (www.eventografie.de)');
    // 12 CC BY-SA + 5 CC BY images need their credit.
    const credited = [...credits.cocktail.values()];
    expect(credited.filter((credit) => /CC BY-SA \d/.test(credit))).toHaveLength(12);
    expect(credited.filter((credit) => /CC BY \d/.test(credit))).toHaveLength(5);
    expect(readdirSync(join(TEMPLATES_DIR, 'all-time-classics', 'images')).sort()).toEqual(Object.keys(manifest.attributions ?? {}).sort());
  });
});

describe('image credits', () => {
  it('maps image files to the names of their items', () => {
    const credits = resolveImageCredits(
      {
        glass: [{ id: 'g1', name: 'Coupette', image: 'file:images/coupe.png' }],
        cocktailRecipe: [
          { id: 'c1', name: 'Daiquiri' },
          { id: 'c2', name: 'Negroni' },
        ],
        cocktailRecipeImage: [
          { cocktailRecipeId: 'c1', image: 'file:images/daiquiri.jpg' },
          { cocktailRecipeId: 'c2', image: 'file:images/unknown.jpg' },
        ],
      },
      { 'daiquiri.jpg': 'Photo by A, CC BY 2.0', 'coupe.png': 'Icon by B, CC0' },
    );
    expect(Object.fromEntries(credits.cocktail)).toEqual({ Daiquiri: 'Photo by A, CC BY 2.0' });
    expect(Object.fromEntries(credits.glass)).toEqual({ Coupette: 'Icon by B, CC0' });
    expect(credits.ingredient.size).toBe(0);
  });

  it('only applies to built-in templates of the repo version', () => {
    const version = readBuiltInManifest('all-time-classics').version;
    expect(builtInImageCredits({ key: 'all-time-classics', version, builtIn: true })?.cocktail.size).toBe(22);
    expect(builtInImageCredits({ key: 'all-time-classics', version: version + 1, builtIn: true })).toBeNull();
    expect(builtInImageCredits({ key: 'all-time-classics', version, builtIn: false })).toBeNull();
    expect(builtInImageCredits({ key: 'base', version: readBuiltInManifest('base').version, builtIn: true })).toBeNull();
  });

  it('rejects attribution keys that are not image file names', () => {
    const manifest = { key: 'a', kind: 'CATALOG', version: 1, name: { de: 'x' }, locales: ['de'] };
    expect(TemplateManifestSchema.safeParse({ ...manifest, attributions: { 'lime.png': 'Photo by A' } }).success).toBe(true);
    expect(TemplateManifestSchema.safeParse({ ...manifest, attributions: { '../lime.png': 'Photo by A' } }).success).toBe(false);
    expect(TemplateManifestSchema.safeParse({ ...manifest, attributions: { 'lime.png': '' } }).success).toBe(false);
  });
});
