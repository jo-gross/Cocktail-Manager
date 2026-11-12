/**
 * Zod schemas + ResourceApiDoc for the Tags resource (v1). Pure module (zod +
 * type-only enums) so scripts/generate-openapi.ts can import it without pulling
 * the Prisma runtime. The legacy endpoint aggregates the distinct tag strings
 * used across cocktails and ingredients, so the DTO is a plain list of strings.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public tags DTO — the deduplicated list of tag strings in the workspace. */
export const TagsDtoSchema = z.array(z.string()).openapi('Tags');

export type TagsDto = z.infer<typeof TagsDtoSchema>;

export const tagsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.tagsCore],
      summary: 'List tags',
      description: 'List all distinct tags used across cocktails and ingredients of a workspace.',
      params: WorkspaceIdParam,
      response: TagsDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

/** `LocalizedText` — content locale → text, e.g. `{ "de": "Fruchtig", "en": "Fruity" }`. */
export const LocalizedTextSchema = z
  .record(z.string(), z.string())
  .openapi('LocalizedText', { description: 'Text per content locale, e.g. { "de": "Fruchtig", "en": "Fruity" }.', example: { de: 'Fruchtig', en: 'Fruity' } });

const TagColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex color like #ff8800')
  .nullable()
  .openapi({ description: 'Hex color (#rrggbb) or null.', example: '#e11d48' });

export const TagCategoryDtoSchema = z
  .object({
    id: z.string(),
    name: LocalizedTextSchema,
    order: z.number().int(),
    showAsGuestFilter: z.boolean().openapi({ description: 'Whether the category is offered as a filter on guest menus.' }),
    tagCount: z.number().int().openapi({ description: 'Number of tag definitions assigned to this category.' }),
  })
  .openapi('TagCategory');

export type TagCategoryDto = z.infer<typeof TagCategoryDtoSchema>;

export const TagCategoryCreateSchema = z
  .object({
    name: LocalizedTextSchema,
    order: z.number().int().optional().openapi({ description: 'Sort order; defaults to the end of the list.' }),
    showAsGuestFilter: z.boolean().optional().openapi({ description: 'Default true.' }),
  })
  .openapi('TagCategoryCreateInput');

export const TagCategoryUpdateSchema = z
  .object({
    name: LocalizedTextSchema.optional(),
    order: z.number().int().optional(),
    showAsGuestFilter: z.boolean().optional(),
  })
  .openapi('TagCategoryUpdateInput');

export const TagCategoriesBulkUpdateSchema = z
  .array(
    z.object({
      id: z.string().optional().openapi({ description: 'Existing category id; omit to create a new category.' }),
      name: LocalizedTextSchema,
      order: z.number().int(),
      showAsGuestFilter: z.boolean(),
    }),
  )
  .openapi('TagCategoriesBulkUpdateInput', { description: 'Categories to upsert (existing categories not listed stay untouched).' });

export const TagCategoryItemParams = WorkspaceIdParam.extend({ categoryId: z.string() });

export type TagCategoryCreateInput = z.infer<typeof TagCategoryCreateSchema>;
export type TagCategoryUpdateInput = z.infer<typeof TagCategoryUpdateSchema>;
export type TagCategoriesBulkUpdateInput = z.infer<typeof TagCategoriesBulkUpdateSchema>;

export const TagDefinitionDtoSchema = z
  .object({
    tag: z.string().openapi({ description: 'The raw tag string as stored on cocktails/ingredients.' }),
    label: LocalizedTextSchema.nullable().openapi({ description: 'Display label per content locale; null = use the raw tag.' }),
    categoryId: z.string().nullable(),
    color: z.string().nullable(),
    isPublic: z.boolean().openapi({ description: 'Whether the tag may be shown on public guest menus.' }),
    defined: z.boolean().openapi({ description: 'False when the tag is only in use and has no stored definition yet (defaults apply).' }),
    cocktailCount: z.number().int().openapi({ description: 'Number of cocktails using the tag.' }),
    ingredientCount: z.number().int().openapi({ description: 'Number of ingredients using the tag.' }),
  })
  .openapi('TagDefinition');

export type TagDefinitionDto = z.infer<typeof TagDefinitionDtoSchema>;

export const TagDefinitionsBulkUpdateSchema = z
  .array(
    z
      .object({
        tag: z.string().min(1),
        label: LocalizedTextSchema.nullable().optional(),
        categoryId: z.string().nullable().optional(),
        color: TagColorSchema.optional(),
        isPublic: z.boolean().optional(),
      })
      .openapi('TagDefinitionUpsertInput'),
  )
  .max(5000)
  .openapi('TagDefinitionsBulkUpdateInput', { description: 'Tag definitions to upsert by tag. Omitted fields keep their current value.' });

export type TagDefinitionsBulkUpdateInput = z.infer<typeof TagDefinitionsBulkUpdateSchema>;

export const tagCategoriesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags/categories',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'TAGS_READ',
      tags: [ApiTags.tagsMetadata],
      summary: 'List tag categories',
      description: 'List the tag categories of a workspace, ordered by `order`.',
      params: WorkspaceIdParam,
      response: z.array(TagCategoryDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Create tag category',
      params: WorkspaceIdParam,
      body: TagCategoryCreateSchema,
      response: TagCategoryDtoSchema,
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Bulk upsert tag categories',
      description: 'Creates or updates the given categories (e.g. after reordering) and returns the full list.',
      params: WorkspaceIdParam,
      body: TagCategoriesBulkUpdateSchema,
      response: z.array(TagCategoryDtoSchema),
      errorResponses: { 404: 'A referenced category does not exist in this workspace.' },
    },
  },
} satisfies ResourceApiDoc;

export const tagCategoriesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags/categories/{categoryId}',
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Update tag category',
      params: TagCategoryItemParams,
      body: TagCategoryUpdateSchema,
      response: TagCategoryDtoSchema,
      errorResponses: { 404: 'Category not found.' },
    },
    DELETE: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Delete tag category',
      description: 'Deletes the category; assigned tag definitions keep existing without a category.',
      params: TagCategoryItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const tagCategoriesDefaultsApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags/categories/defaults',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Create default tag categories',
      description: 'Creates the default categories (Flavor, Spirit, Style, Properties, Season) that do not exist yet and returns the full list.',
      params: WorkspaceIdParam,
      response: z.array(TagCategoryDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const tagDefinitionsApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags/definitions',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'TAGS_READ',
      tags: [ApiTags.tagsMetadata],
      summary: 'List tag definitions',
      description:
        'Lists every tag that is in use or has a stored definition, with usage counts. Tags without a definition use the defaults (no label/category/color, public).',
      params: WorkspaceIdParam,
      response: z.array(TagDefinitionDtoSchema),
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'TAGS_UPDATE',
      tags: [ApiTags.tagsMetadata],
      summary: 'Bulk upsert tag definitions',
      description: 'Creates or updates tag definitions keyed by tag and returns the full list.',
      params: WorkspaceIdParam,
      body: TagDefinitionsBulkUpdateSchema,
      response: z.array(TagDefinitionDtoSchema),
      errorResponses: { 404: 'A referenced category does not exist in this workspace.' },
    },
  },
} satisfies ResourceApiDoc;
