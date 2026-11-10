/**
 * Translatable content fields per entity (see docs/GUEST-MENU-CONCEPT.md,
 * "Mehrsprachigkeit"). Pure module – shared by zod schemas, the API controller,
 * the translation center and the form language tabs. `notes` is never
 * translatable (internal only).
 */

export const CONTENT_TRANSLATION_ENTITY_TYPES = ['cocktail', 'ingredient', 'garnish', 'glass'] as const;

export type ContentTranslationEntityType = (typeof CONTENT_TRANSLATION_ENTITY_TYPES)[number];

export const CONTENT_TRANSLATION_FIELDS = {
  cocktail: ['name', 'description', 'history'],
  ingredient: ['name', 'guestName', 'description'],
  garnish: ['name', 'description'],
  glass: ['name'],
} as const satisfies Record<ContentTranslationEntityType, readonly string[]>;

export type ContentTranslationField<E extends ContentTranslationEntityType = ContentTranslationEntityType> = (typeof CONTENT_TRANSLATION_FIELDS)[E][number];

/** Union of every translatable field name across all entities. */
export const ALL_CONTENT_TRANSLATION_FIELDS = ['name', 'guestName', 'description', 'history'] as const;

export type AnyContentTranslationField = (typeof ALL_CONTENT_TRANSLATION_FIELDS)[number];

export function isContentTranslationEntityType(value: string): value is ContentTranslationEntityType {
  return (CONTENT_TRANSLATION_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isTranslatableField(entityType: ContentTranslationEntityType, field: string): boolean {
  return (CONTENT_TRANSLATION_FIELDS[entityType] as readonly string[]).includes(field);
}

/** Fields rendered as multi-line text areas in editors. */
export function isMultilineContentField(field: string): boolean {
  return field === 'description' || field === 'history';
}

/** Stable key for a single translation cell. */
export function contentTranslationKey(entityType: string, entityId: string, field: string, locale: string): string {
  return `${entityType}:${entityId}:${field}:${locale}`;
}
