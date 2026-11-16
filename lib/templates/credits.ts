/**
 * Image credits of built-in templates: `attributions` of the manifest (image file → credit line)
 * resolved to the items of the template. The template workspace is a read-only copy of
 * `backup.json` with new ids, so items are matched to the backup by their primary name.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { WorkspaceTemplate } from '@generated/prisma/client';
import { TEMPLATES_DIR, TEMPLATE_IMAGE_PREFIX, listBuiltInTemplateKeys, readBuiltInManifest } from '@lib/templates/builtIn';

export type TemplateCreditKind = 'glass' | 'ingredient' | 'garnish' | 'cocktail';

/** Primary name of an item → credit line of its image. */
export type TemplateImageCredits = Record<TemplateCreditKind, Map<string, string>>;

type Row = { id: string; name: string; image?: string | null };
type ImageRow = { image: string } & Record<string, string>;

/** Backup collections per kind: entities, image rows and the entity field of an image row. */
const COLLECTIONS: Record<TemplateCreditKind, { entities: string; images: string; idField: string }> = {
  glass: { entities: 'glass', images: 'glassImages', idField: 'glassId' },
  ingredient: { entities: 'ingredient', images: 'ingredientImages', idField: 'ingredientId' },
  garnish: { entities: 'garnish', images: 'garnishImages', idField: 'garnishId' },
  cocktail: { entities: 'cocktailRecipe', images: 'cocktailRecipeImage', idField: 'cocktailRecipeId' },
};

/** Pure: credits per kind from a raw (unresolved) backup and the manifest attributions. */
export function resolveImageCredits(backup: Record<string, unknown>, attributions: Record<string, string>): TemplateImageCredits {
  const creditOf = (reference: unknown) =>
    typeof reference === 'string' && reference.startsWith(TEMPLATE_IMAGE_PREFIX) ? attributions[reference.slice(TEMPLATE_IMAGE_PREFIX.length)] : undefined;
  const result = {} as TemplateImageCredits;
  for (const [kind, { entities, images, idField }] of Object.entries(COLLECTIONS) as Array<[TemplateCreditKind, (typeof COLLECTIONS)[TemplateCreditKind]]>) {
    const rows = (Array.isArray(backup[entities]) ? backup[entities] : []) as Row[];
    const names = new Map(rows.map((row) => [row.id, row.name]));
    const credits = new Map<string, string>();
    for (const row of rows) {
      const credit = creditOf(row.image);
      if (credit) credits.set(row.name, credit);
    }
    for (const row of (Array.isArray(backup[images]) ? backup[images] : []) as ImageRow[]) {
      const name = names.get(row[idField]!);
      const credit = creditOf(row.image);
      if (name != null && credit) credits.set(name, credit);
    }
    result[kind] = credits;
  }
  return result;
}

const cache = new Map<string, TemplateImageCredits | null>();

/**
 * Credits of a built-in template, or null (custom template, no attributions, or the database copy
 * is not the version in the repo). Memoized per key and version; never throws.
 */
export function builtInImageCredits(template: Pick<WorkspaceTemplate, 'key' | 'version' | 'builtIn'>, dir = TEMPLATES_DIR): TemplateImageCredits | null {
  if (!template.builtIn) return null;
  const cacheKey = `${dir}\0${template.key}@${template.version}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  let credits: TemplateImageCredits | null = null;
  try {
    if (listBuiltInTemplateKeys(dir).includes(template.key)) {
      const manifest = readBuiltInManifest(template.key, dir);
      const backupPath = join(dir, template.key, 'backup.json');
      if (manifest.version === template.version && manifest.attributions && existsSync(backupPath)) {
        credits = resolveImageCredits(JSON.parse(readFileSync(backupPath, 'utf-8')) as Record<string, unknown>, manifest.attributions);
      }
    }
  } catch (error) {
    console.error(`[Templates] Image credits of "${template.key}" could not be read:`, error);
  }
  cache.set(cacheKey, credits);
  return credits;
}
