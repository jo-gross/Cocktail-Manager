/**
 * Zod schemas + ResourceApiDocs for the instance administration of templates
 * (`/api/admin/templates`, master key only). Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { DateTimeString } from '@lib/schemas/common';
import { TemplateKeyParam, TemplateKindEnum } from '@lib/schemas/templates';
import { TemplateKeySchema, TemplateLocaleSchema, TemplateLocalizedTextSchema } from '@lib/templates/manifest';
import type { ResourceApiDoc } from '@lib/openapi/types';

const LocalizedText = TemplateLocalizedTextSchema.openapi({ description: 'Text per language, e.g. `{ "de": "Klassiker", "en": "Classics" }`.' });

export const AdminTemplateDtoSchema = z
  .object({
    key: z.string(),
    workspaceId: z.string(),
    kind: TemplateKindEnum,
    name: z.record(z.string(), z.string()),
    description: z.record(z.string(), z.string()).nullable(),
    locales: z.array(z.string()),
    source: z.string().nullable(),
    builtIn: z.boolean().openapi({ description: 'Shipped with the app (`templates/<key>/`); read-only, replaced by newer releases.' }),
    version: z.number().int(),
    published: z.boolean(),
    isDefault: z.boolean(),
    sortOrder: z.number().int(),
    memberCount: z.number().int(),
    updatedAt: DateTimeString,
  })
  .openapi('AdminTemplate');

const TemplateMetadataFields = {
  name: LocalizedText,
  description: LocalizedText.nullish(),
  locales: z.array(TemplateLocaleSchema).min(1).max(20).openapi({ description: 'Content languages; the first one is the primary language.' }),
  source: z.string().max(500).nullish(),
  published: z.boolean().optional(),
  isDefault: z.boolean().optional().openapi({ description: 'Default template of its kind (only one per kind; setting it clears the others).' }),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
};

export const AdminTemplateCreateSchema = z
  .object({
    workspaceId: z.string().min(1).max(128).openapi({ description: 'Existing (non-demo) workspace that becomes the template.' }),
    key: TemplateKeySchema,
    kind: TemplateKindEnum,
    ...TemplateMetadataFields,
  })
  .openapi('AdminTemplateCreateInput');

export const AdminTemplateUpdateSchema = z
  .object({
    name: TemplateMetadataFields.name.optional(),
    description: TemplateMetadataFields.description,
    locales: TemplateMetadataFields.locales.optional(),
    source: TemplateMetadataFields.source,
    published: TemplateMetadataFields.published,
    isDefault: TemplateMetadataFields.isDefault,
    sortOrder: TemplateMetadataFields.sortOrder,
  })
  .openapi('AdminTemplateUpdateInput');

export const AdminTemplateCloneSchema = z
  .object({
    key: TemplateKeySchema.openapi({ description: 'Key of the new (custom) template.' }),
    name: LocalizedText.optional().openapi({ description: 'Name of the clone; default: name of the source.' }),
  })
  .openapi('AdminTemplateCloneInput');

export const AdminTemplateAccessDtoSchema = z
  .object({
    template: AdminTemplateDtoSchema,
    joinCode: z.string().openapi({ description: 'One-time join code for the template workspace; the first member becomes its owner.' }),
  })
  .openapi('AdminTemplateAccess');

export type AdminTemplateDto = z.infer<typeof AdminTemplateDtoSchema>;
export type AdminTemplateCreateInput = z.infer<typeof AdminTemplateCreateSchema>;
export type AdminTemplateUpdateInput = z.infer<typeof AdminTemplateUpdateSchema>;
export type AdminTemplateCloneInput = z.infer<typeof AdminTemplateCloneSchema>;
export type AdminTemplateAccessDto = z.infer<typeof AdminTemplateAccessDtoSchema>;

export const adminTemplatesCollectionApiDoc = {
  basePath: '/admin/templates',
  pathPrefix: '/api',
  operations: {
    GET: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'List all templates',
      description: 'All templates including unpublished ones (built-in templates are synced into the database first).',
      response: z.array(AdminTemplateDtoSchema),
    },
    POST: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'Mark workspace as template',
      description: 'Marks an existing workspace as (custom) template. Template workspaces cannot be deleted while marked.',
      body: AdminTemplateCreateSchema,
      response: AdminTemplateDtoSchema,
      status: 201,
      errorResponses: { 404: 'Workspace not found.', 409: 'Key taken (`TEMPLATE_KEY_TAKEN`) or workspace already a template (`ALREADY_TEMPLATE`).' },
    },
  },
} satisfies ResourceApiDoc;

export const adminTemplatesItemApiDoc = {
  basePath: '/admin/templates/{key}',
  pathPrefix: '/api',
  operations: {
    PATCH: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'Update template metadata',
      description: 'Updates name, description, languages, source, `published`, `isDefault` (one default per kind) and `sortOrder`.',
      params: TemplateKeyParam,
      body: AdminTemplateUpdateSchema,
      response: AdminTemplateDtoSchema,
      errorResponses: { 404: 'Template not found.' },
    },
    DELETE: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'Unmark template',
      description: 'Removes the template mark of a custom template; its workspace stays. Built-in templates cannot be removed (409 `BUILT_IN_TEMPLATE`).',
      params: TemplateKeyParam,
      response: AdminTemplateDtoSchema,
      errorResponses: { 404: 'Template not found.', 409: 'Built-in template.' },
    },
  },
} satisfies ResourceApiDoc;

export const adminTemplatesCloneApiDoc = {
  basePath: '/admin/templates/{key}/clone',
  pathPrefix: '/api',
  operations: {
    POST: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'Clone template',
      description:
        'Copies the template into a new memberless workspace with a new key (custom, unpublished) and returns a one-time join code; the first member becomes its owner.',
      params: TemplateKeyParam,
      body: AdminTemplateCloneSchema,
      response: AdminTemplateAccessDtoSchema,
      status: 201,
      errorResponses: { 404: 'Template not found.', 409: 'Key taken (`TEMPLATE_KEY_TAKEN`).' },
    },
  },
} satisfies ResourceApiDoc;

export const adminTemplatesAccessApiDoc = {
  basePath: '/admin/templates/{key}/access',
  pathPrefix: '/api',
  operations: {
    POST: {
      roles: [],
      permission: null,
      auth: 'master',
      tags: [ApiTags.adminTemplates],
      summary: 'Create join code for a template',
      description:
        'One-time join code for editing a custom template (memberless: the first member becomes owner; otherwise a join request). Built-in templates are read-only (409 `BUILT_IN_TEMPLATE`) – clone them instead.',
      params: TemplateKeyParam,
      response: AdminTemplateAccessDtoSchema,
      status: 201,
      errorResponses: { 404: 'Template not found.', 409: 'Built-in template.' },
    },
  },
} satisfies ResourceApiDoc;
