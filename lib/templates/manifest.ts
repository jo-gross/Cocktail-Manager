/**
 * `templates/<key>/manifest.json` of a built-in template (docs/plans/ONBOARDING-PLAN.md).
 * The manifest seeds the `WorkspaceTemplate` row; afterwards the database is authoritative
 * for `published`, `isDefault` and `sortOrder`. Pure module (zod only).
 */
import { z } from 'zod';
import { isValidContentLocale } from '@lib/workspace/workspaceLocaleSettings';

export const TEMPLATE_KINDS = ['BASE', 'CATALOG', 'DEMO'] as const;
export type TemplateKindName = (typeof TEMPLATE_KINDS)[number];

/** Lowercase letters, digits and single dashes; doubles as directory name. */
export const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TemplateKeySchema = z.string().min(1).max(64).regex(TEMPLATE_KEY_PATTERN, 'Only lowercase letters, digits and single dashes');

export const TemplateLocaleSchema = z.string().max(35).refine(isValidContentLocale, 'Invalid locale code (expected e.g. "de" or "en")');

/** File name inside a template's `images/`: no directories, no leading dot. */
export const TEMPLATE_IMAGE_NAME_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/;

export const TemplateLocalizedTextSchema = z
  .record(TemplateLocaleSchema, z.string().trim().min(1).max(500))
  .refine((value) => Object.keys(value).length > 0, 'At least one language is required');

export const TemplateManifestSchema = z.object({
  key: TemplateKeySchema,
  kind: z.enum(TEMPLATE_KINDS),
  /** Increase to replace the database copy on the next start (`pnpm templates:pull` does it). */
  version: z.number().int().min(1),
  name: TemplateLocalizedTextSchema,
  description: TemplateLocalizedTextSchema.optional(),
  /** Content languages; the first one is the primary language of the content (names on the entities). */
  locales: z.array(TemplateLocaleSchema).min(1).max(20),
  source: z.string().max(500).optional(),
  /** Credit line per image file of `images/` (license attribution, shown wherever the image is offered). */
  attributions: z
    .record(z.string().regex(TEMPLATE_IMAGE_NAME_PATTERN, 'Image file name inside images/'), z.string().trim().min(1).max(1000))
    .refine((value) => Object.keys(value).length <= 1000, 'Too many attributions')
    .optional(),
  published: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
});

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;
