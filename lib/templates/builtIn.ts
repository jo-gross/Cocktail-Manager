/**
 * Built-in templates shipped with the app: `templates/<key>/manifest.json`, `backup.json`
 * (backup format) and `images/`. Images are referenced inside the backup as
 * `file:images/<name>` and resolved to data URIs here (raster formats only, no paths
 * outside the template's `images/` directory).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';
import { TEMPLATE_KEY_PATTERN, TemplateManifestSchema, type TemplateManifest } from '@lib/templates/manifest';

export const TEMPLATES_DIR = join(process.cwd(), 'templates');

export const TEMPLATE_IMAGE_PREFIX = 'file:images/';

export const TEMPLATE_IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** File name inside `images/`: no directories, no leading dot. */
const IMAGE_NAME_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/;

export interface BuiltInTemplate {
  manifest: TemplateManifest;
  /** Backup with images resolved to data URIs (validated by the import pipeline). */
  backup: unknown;
}

export function listBuiltInTemplateKeys(dir = TEMPLATES_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => TEMPLATE_KEY_PATTERN.test(name) && existsSync(join(dir, name, 'manifest.json')))
    .sort();
}

/** Reads `images/<name>` of a template as data URI; throws for anything that is not a raster image file there. */
export function readTemplateImage(templateDir: string, reference: string): string {
  const name = reference.slice(TEMPLATE_IMAGE_PREFIX.length);
  if (!reference.startsWith(TEMPLATE_IMAGE_PREFIX) || !IMAGE_NAME_PATTERN.test(name) || name.includes('..')) {
    throw new Error(`Invalid template image reference "${reference.slice(0, 100)}"`);
  }
  const mimeType = TEMPLATE_IMAGE_MIME_TYPES[extname(name).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported template image type (raster images only): ${name}`);
  const path = join(templateDir, 'images', name);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Template image not found: ${name}`);
  return `data:${mimeType};base64,${readFileSync(path).toString('base64')}`;
}

/** Fields that hold images in the backup format (`image` of entities/image rows, `content` of signage slides). */
const IMAGE_FIELDS = new Set(['image', 'content']);

/** Replaces every `file:…` value of an image field in the backup by the referenced image (data URI). */
export function resolveTemplateImages(value: unknown, templateDir: string, field?: string): unknown {
  if (typeof value === 'string') return field && IMAGE_FIELDS.has(field) && value.startsWith('file:') ? readTemplateImage(templateDir, value) : value;
  if (Array.isArray(value)) return value.map((item) => resolveTemplateImages(item, templateDir, field));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplateImages(item, templateDir, key)]));
  }
  return value;
}

export function readBuiltInManifest(key: string, dir = TEMPLATES_DIR): TemplateManifest {
  if (!TEMPLATE_KEY_PATTERN.test(key)) throw new Error(`Invalid template key "${key.slice(0, 64)}"`);
  const manifest = TemplateManifestSchema.parse(JSON.parse(readFileSync(join(dir, key, 'manifest.json'), 'utf-8')));
  if (manifest.key !== key) throw new Error(`Template manifest key "${manifest.key}" does not match its directory "${key}"`);
  return manifest;
}

export function loadBuiltInTemplate(key: string, dir = TEMPLATES_DIR): BuiltInTemplate {
  const manifest = readBuiltInManifest(key, dir);
  const templateDir = join(dir, key);
  const backup = resolveTemplateImages(JSON.parse(readFileSync(join(templateDir, 'backup.json'), 'utf-8')), templateDir);
  return { manifest, backup };
}
