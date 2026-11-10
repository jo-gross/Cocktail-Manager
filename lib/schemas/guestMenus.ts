/**
 * Zod schemas + ResourceApiDocs for guest menus (Gästekarten, v1).
 * Spec: docs/GUEST-MENU-CONCEPT.md. Pure module (zod + type-only imports).
 *
 * Menus have meta fields (name/slug/schedule/source, edited via PATCH), a
 * `draft` document (PUT /draft, zod-validated) and an immutable `published`
 * snapshot (POST /publish copies draft → published after template validation).
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import { GUEST_MENU_OUTPUTS, GuestMenuDocumentSchema, GuestMenuTemplateDefinitionSchema, PRINT_PAPERS, TEMPLATE_SLOTS } from '@lib/guest-menu/schema';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const GuestMenuInactiveBehaviorEnum = z.enum(['NOTICE_WITH_LINK', 'NOTICE_WITH_CONTENT', 'REDIRECT']).openapi('GuestMenuInactiveBehavior');
export const GuestMenuSourceModeEnum = z.enum(['NONE', 'FIXED_CARD', 'ACTIVE_CARD']).openapi('GuestMenuSourceMode');
export const GuestMenuOutputEnum = z.enum(GUEST_MENU_OUTPUTS).openapi('GuestMenuOutput');

/** URL slug: lowercase a-z, 0-9 and single dashes. */
export const GuestMenuSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain a-z, 0-9 and single dashes')
  .openapi({ example: 'abendkarte' });

const DateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .openapi({ example: '2026-12-01' });
const TimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Expected HH:mm')
  .openapi({ example: '18:00' });
const LocaleCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Invalid locale code');

export const GuestMenuDocumentDtoSchema = GuestMenuDocumentSchema.openapi('GuestMenuDocument', {
  description: 'Guest menu document (lib/guest-menu/schema.ts, schemaVersion 1).',
});

export const GuestMenuValiditySchema = z
  .object({
    valid: z.boolean(),
    reason: z.enum(['disabled', 'unpublished', 'notYetValid', 'expired', 'weekday', 'time']).nullable(),
  })
  .openapi('GuestMenuValidity');

export const GuestMenuSummaryDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    enabled: z.boolean(),
    isDefault: z.boolean(),
    priority: z.number().int().openapi({ description: 'Lower number = higher priority.' }),
    validFrom: z.string().nullable().openapi({ description: 'YYYY-MM-DD (inclusive) or null.' }),
    validTo: z.string().nullable().openapi({ description: 'YYYY-MM-DD (inclusive) or null.' }),
    weekdays: z.array(z.number().int()).openapi({ description: '0 = Sunday … 6 = Saturday; empty = every day.' }),
    timeFrom: z.string().nullable().openapi({ description: '"HH:mm" in the workspace timezone; windows may cross midnight.' }),
    timeTo: z.string().nullable(),
    inactiveBehavior: GuestMenuInactiveBehaviorEnum,
    sourceMode: GuestMenuSourceModeEnum,
    sourceCardId: z.string().nullable(),
    locales: z.array(z.string()).openapi({ description: 'Offered content locales; empty = workspace contentLocales.' }),
    isPublished: z.boolean(),
    publishedAt: DateTimeString.nullable(),
    hasUnpublishedChanges: z.boolean(),
    previewToken: z
      .string()
      .nullable()
      .openapi({ description: 'Use `?preview=<token>` on the public URL to see the draft. Null for members with the USER role.' }),
    publicPath: z.string().openapi({ description: 'Relative public URL, e.g. `/m/my-bar/abendkarte`.' }),
    hasAccessCode: z.boolean().openapi({ description: 'Guests need an access code (PIN) to open the menu. The code itself is never returned.' }),
    validity: GuestMenuValiditySchema.openapi({ description: 'Schedule validity right now (workspace timezone).' }),
    isActive: z.boolean().openapi({ description: 'True if this menu is the one currently shown at `/m/{bar}`.' }),
    createdAt: DateTimeString,
    updatedAt: DateTimeString,
  })
  .openapi('GuestMenuSummary');

export const GuestMenuDtoSchema = GuestMenuSummaryDtoSchema.extend({
  draft: GuestMenuDocumentDtoSchema,
  published: GuestMenuDocumentDtoSchema.nullable(),
}).openapi('GuestMenu');

export type GuestMenuSummaryDto = z.infer<typeof GuestMenuSummaryDtoSchema>;
export type GuestMenuDto = z.infer<typeof GuestMenuDtoSchema>;

const MetaFields = {
  name: z.string().trim().min(1).max(200),
  slug: GuestMenuSlugSchema,
  enabled: z.boolean(),
  isDefault: z.boolean().openapi({ description: 'Only one default menu per workspace; setting it unsets the others.' }),
  priority: z.number().int().min(0).max(100_000),
  validFrom: DateKey.nullable(),
  validTo: DateKey.nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  timeFrom: TimeOfDay.nullable(),
  timeTo: TimeOfDay.nullable(),
  inactiveBehavior: GuestMenuInactiveBehaviorEnum,
  sourceMode: GuestMenuSourceModeEnum,
  sourceCardId: z.string().nullable(),
  locales: z.array(LocaleCode).max(20),
};

export const GuestMenuCreateSchema = z
  .object({
    name: MetaFields.name,
    slug: MetaFields.slug.optional().openapi({ description: 'Generated from the name when omitted.' }),
    sourceMode: MetaFields.sourceMode.optional(),
    sourceCardId: MetaFields.sourceCardId.optional(),
    locales: MetaFields.locales.optional(),
    templateId: z.string().min(1).max(128).optional().openapi({ description: 'Built-in template for all outputs of the new default document.' }),
    document: GuestMenuDocumentDtoSchema.optional().openapi({ description: 'Initial draft; a default document is created when omitted.' }),
  })
  .openapi('GuestMenuCreateInput');
export type GuestMenuCreateInput = z.infer<typeof GuestMenuCreateSchema>;

export const GuestMenuAccessCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{4,12}$/, '4–12 digits or letters')
  .openapi({ description: '4–12 digits or latin letters/digits (case-insensitive).', example: '2580' });

export const GuestMenuUpdateSchema = z
  .object({
    ...(Object.fromEntries(Object.entries(MetaFields).map(([key, schema]) => [key, schema.optional()])) as {
      [K in keyof typeof MetaFields]: z.ZodOptional<(typeof MetaFields)[K]>;
    }),
    accessCode: GuestMenuAccessCodeSchema.nullable().optional().openapi({
      description:
        'Set (string) or remove (null) the guest access code. Stored hashed only, never returned (see `hasAccessCode`). Every change invalidates existing guest sessions and signage tokens.',
    }),
  })
  .openapi('GuestMenuUpdateInput', { description: 'Partial update of the menu meta data (omitted = unchanged).' });
export type GuestMenuUpdateInput = z.infer<typeof GuestMenuUpdateSchema>;

export const GuestMenuDuplicateSchema = z
  .object({
    name: MetaFields.name.optional(),
    slug: MetaFields.slug.optional(),
  })
  .openapi('GuestMenuDuplicateInput');
export type GuestMenuDuplicateInput = z.infer<typeof GuestMenuDuplicateSchema>;

export const GuestMenuReorderSchema = z
  .object({
    menuIds: z.array(z.string()).min(1).openapi({ description: 'Menu ids in priority order; priority = index (0 = highest).' }),
  })
  .openapi('GuestMenuReorderInput');
export type GuestMenuReorderInput = z.infer<typeof GuestMenuReorderSchema>;

export const GuestMenuPreviewQuerySchema = z.object({
  locale: LocaleCode.optional(),
  output: GuestMenuOutputEnum.optional().openapi({ description: 'Default web.' }),
  source: z.enum(['draft', 'published']).optional().openapi({ description: 'Default draft.' }),
});
export type GuestMenuPreviewQuery = z.infer<typeof GuestMenuPreviewQuerySchema>;

export const GuestMenuRenderedSchema = z
  .object({
    dto: z.record(z.string(), z.unknown()).openapi({ description: 'PublicMenuDto (lib/guest-menu/schema.ts).' }),
    rendered: z
      .record(z.string(), z.unknown())
      .openapi({ description: 'RenderedMenu (lib/guest-menu/render): css, menuHeader, sections, blocks, footer, errors.' }),
  })
  .openapi('GuestMenuRendered');

export const GuestMenuPublishIssueSchema = z
  .object({
    output: GuestMenuOutputEnum,
    source: z.enum(['syntax', 'render', 'css', 'customCss']),
    slot: z.string(),
    message: z.string(),
    line: z.number().int().nullable(),
    column: z.number().int().nullable(),
  })
  .openapi('GuestMenuPublishIssue');
export type GuestMenuPublishIssue = z.infer<typeof GuestMenuPublishIssueSchema>;

export const GuestMenuQrQuerySchema = z.object({
  target: z.enum(['bar', 'menu']).optional().openapi({ description: '`bar` → /m/{bar} (active menu), `menu` → /m/{bar}/{slug}. Default menu.' }),
  margin: z.coerce.number().int().min(0).max(10).optional(),
  code: z.string().max(32).optional().openapi({
    description:
      'Access code of a protected menu: the QR link gets `?code=…` (unlocks directly, e.g. for table QR codes). Must match the stored code (422 otherwise).',
  }),
});

// Templates ----------------------------------------------------------------

export const GuestMenuTemplateDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    templateId: z.string().openapi({ description: 'Value for `document.templates[output].templateId` (`custom:<id>`).' }),
    definition: GuestMenuTemplateDefinitionSchema,
    createdAt: DateTimeString,
    updatedAt: DateTimeString,
  })
  .openapi('GuestMenuTemplate');
export type GuestMenuTemplateDto = z.infer<typeof GuestMenuTemplateDtoSchema>;

export const GuestMenuTemplateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    definition: GuestMenuTemplateDefinitionSchema,
  })
  .openapi('GuestMenuTemplateInput');
export type GuestMenuTemplateInput = z.infer<typeof GuestMenuTemplateInputSchema>;

export const BuiltInGuestMenuTemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    outputs: z.array(GuestMenuOutputEnum),
    layout: z.string(),
    defaultTokens: z.record(z.string(), z.unknown()),
    slots: z.object(Object.fromEntries(TEMPLATE_SLOTS.map((slot) => [slot, z.string()])) as Record<(typeof TEMPLATE_SLOTS)[number], z.ZodString>),
    css: z.string().openapi({ description: 'Template CSS (unscoped; the base CSS is prepended at render time).' }),
  })
  .openapi('BuiltInGuestMenuTemplate');

export const BuiltInGuestMenuTemplatesSchema = z
  .object({
    templates: z.array(BuiltInGuestMenuTemplateSchema),
    baseCss: z.string(),
    partials: z.record(z.string(), z.string()).openapi({ description: 'Includable partials (`{% include "gm_badges" %}`).' }),
  })
  .openapi('BuiltInGuestMenuTemplates');

// Params ---------------------------------------------------------------------

export const GuestMenuItemParams = WorkspaceIdParam.extend({ menuId: z.string() });
export const GuestMenuTemplateItemParams = WorkspaceIdParam.extend({ templateId: z.string() });

const PUBLISH_ERRORS = { 422: 'Template validation failed (`error.issues`: GuestMenuPublishIssue[] with slot + line).' };

export const guestMenusCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusCore],
      summary: 'List guest menus',
      description: 'All guest menus ordered by priority, with current schedule validity and the active flag.',
      params: WorkspaceIdParam,
      response: z.array(GuestMenuSummaryDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_CREATE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Create guest menu',
      params: WorkspaceIdParam,
      body: GuestMenuCreateSchema,
      response: GuestMenuDtoSchema,
      status: 201,
      errorResponses: { 409: 'Slug already in use.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusReorderApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/reorder',
  legacyPath: false,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Reorder guest menu priorities',
      params: WorkspaceIdParam,
      body: GuestMenuReorderSchema,
      response: z.array(GuestMenuSummaryDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusCore],
      summary: 'Get guest menu',
      description: 'Meta data plus draft and published documents.',
      params: GuestMenuItemParams,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.' },
    },
    PATCH: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Update guest menu meta data',
      description:
        'Name, slug, enabled, default, priority, schedule, inactive behavior, source card, locales and the guest access code. Takes effect immediately (no publish needed).',
      params: GuestMenuItemParams,
      body: GuestMenuUpdateSchema,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.', 409: 'Slug already in use.' },
    },
    DELETE: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_DELETE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Delete guest menu',
      params: GuestMenuItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusDraftApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/draft',
  legacyPath: false,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusContent],
      summary: 'Save guest menu draft',
      description: 'Replaces the draft document (validated against the document schema). Does not affect the published menu.',
      params: GuestMenuItemParams,
      body: GuestMenuDocumentDtoSchema,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusPublishApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/publish',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_PUBLISH',
      tags: [ApiTags.guestMenusContent],
      summary: 'Publish guest menu',
      description: 'Validates and test-renders all enabled outputs, then copies the draft to `published`.',
      params: GuestMenuItemParams,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.', ...PUBLISH_ERRORS },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusUnpublishApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/unpublish',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_PUBLISH',
      tags: [ApiTags.guestMenusContent],
      summary: 'Unpublish guest menu',
      description: 'Removes the published snapshot; the draft is kept.',
      params: GuestMenuItemParams,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusDuplicateApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/duplicate',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_CREATE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Duplicate guest menu',
      description: 'Copies meta data and draft (not published, not default, disabled).',
      params: GuestMenuItemParams,
      body: GuestMenuDuplicateSchema,
      response: GuestMenuDtoSchema,
      status: 201,
      errorResponses: { 404: 'Guest menu not found.', 409: 'Slug already in use.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusPreviewTokenRegenerateApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/preview-token/regenerate',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusCore],
      summary: 'Regenerate draft preview token',
      description: 'Replaces `previewToken` with a new random token; all previously shared `?preview=` links stop working.',
      params: GuestMenuItemParams,
      response: GuestMenuDtoSchema,
      errorResponses: { 404: 'Guest menu not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusPreviewApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/preview',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusContent],
      summary: 'Preview guest menu',
      description:
        'Resolved PublicMenuDto + rendered slots for the draft (default) or published document. Ignores the schedule. Image URLs carry the secret draft preview token, so this is restricted to MANAGER (API keys: GUEST_MENUS_UPDATE).',
      params: GuestMenuItemParams,
      query: GuestMenuPreviewQuerySchema,
      response: GuestMenuRenderedSchema,
      errorResponses: { 404: 'Guest menu (or published document) not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusQrApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/qr.svg',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusContent],
      summary: 'Guest menu QR code (SVG)',
      params: GuestMenuItemParams,
      query: GuestMenuQrQuerySchema,
      rawResponse: { contentTypes: ['image/svg+xml'], description: 'QR code pointing to the public menu URL.' },
      errorResponses: { 404: 'Guest menu not found.', 422: 'The access code does not match this menu.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenuTemplatesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/templates',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'List custom guest menu templates',
      params: WorkspaceIdParam,
      response: z.array(GuestMenuTemplateDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_CREATE',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'Create custom guest menu template',
      params: WorkspaceIdParam,
      body: GuestMenuTemplateInputSchema,
      response: GuestMenuTemplateDtoSchema,
      status: 201,
      errorResponses: PUBLISH_ERRORS,
    },
  },
} satisfies ResourceApiDoc;

export const guestMenuTemplatesBuiltInApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/templates/built-in',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'List built-in guest menu templates',
      description: 'Built-in templates with metadata, Liquid slot sources and CSS, plus base CSS and partials (for forking in the builder).',
      params: WorkspaceIdParam,
      response: BuiltInGuestMenuTemplatesSchema,
    },
  },
} satisfies ResourceApiDoc;

export const guestMenuTemplatesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/templates/{templateId}',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'Get custom guest menu template',
      params: GuestMenuTemplateItemParams,
      response: GuestMenuTemplateDtoSchema,
      errorResponses: { 404: 'Template not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_UPDATE',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'Update custom guest menu template',
      description: 'Published menus using it pick up the change immediately; syntax is validated first.',
      params: GuestMenuTemplateItemParams,
      body: GuestMenuTemplateInputSchema,
      response: GuestMenuTemplateDtoSchema,
      errorResponses: { 404: 'Template not found.', ...PUBLISH_ERRORS },
    },
    DELETE: {
      roles: ['MANAGER'],
      permission: 'GUEST_MENUS_DELETE',
      tags: [ApiTags.guestMenusTemplates],
      summary: 'Delete custom guest menu template',
      params: GuestMenuTemplateItemParams,
      response: DeletionResult,
      errorResponses: { 409: 'Template is used by a guest menu.' },
    },
  },
} satisfies ResourceApiDoc;

// Print / PDF export --------------------------------------------------------

export const GuestMenuPrintPaperEnum = z.enum(PRINT_PAPERS).openapi('GuestMenuPrintPaper', { description: 'A4, A5 or DL (99 × 210 mm).' });

export const GuestMenuPdfExportSchema = z
  .object({
    source: z.enum(['draft', 'published']).openapi({ description: 'Which document to print.' }),
    locale: LocaleCode.optional().openapi({ description: 'Content locale; default `outputs.print.locale` → primary.' }),
    paper: GuestMenuPrintPaperEnum.optional().openapi({ description: 'Default `outputs.print.paper`.' }),
    showQrCode: z.boolean().optional().openapi({ description: 'Default `outputs.print.showQrCode`.' }),
  })
  .openapi('GuestMenuPdfExportInput');
export type GuestMenuPdfExportInput = z.infer<typeof GuestMenuPdfExportSchema>;

export const GuestMenuHtmlExportQuerySchema = z.object({
  source: z.enum(['draft', 'published']).optional().openapi({ description: 'Default draft.' }),
  locale: LocaleCode.optional(),
  paper: GuestMenuPrintPaperEnum.optional(),
  showQrCode: z.enum(['true', 'false']).optional(),
});

export const GuestMenuTableTentQuerySchema = z.object({
  target: z.enum(['bar', 'menu']).optional().openapi({ description: '`bar` → /m/{bar} (always the active menu, default), `menu` → this menu.' }),
  locale: LocaleCode.optional().openapi({ description: 'Language of the card texts.' }),
  paper: z.enum(['A6', 'A5']).optional().openapi({ description: 'Default A6.' }),
});

const PDF_ERRORS = { 404: 'Guest menu (or published document) not found.', 503: 'PDF export service not configured/available.' };

export const guestMenusExportPdfApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/export/pdf',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusContent],
      summary: 'Export guest menu as PDF',
      description:
        'Renders the print output (print template, @page size per paper, inlined fonts/images, optional QR code to the public menu URL) via the Chromium PDF service.',
      params: GuestMenuItemParams,
      body: GuestMenuPdfExportSchema,
      rawResponse: { contentTypes: ['application/pdf'], description: 'The generated PDF document.' },
      errorResponses: PDF_ERRORS,
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusExportHtmlApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/export/html',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusContent],
      summary: 'Export guest menu print HTML',
      description: 'The self-contained HTML document used for the PDF export (print preview & debugging).',
      params: GuestMenuItemParams,
      query: GuestMenuHtmlExportQuerySchema,
      rawResponse: { contentTypes: ['text/html'], description: 'Self-contained print HTML.' },
      errorResponses: { 404: PDF_ERRORS[404] },
    },
  },
} satisfies ResourceApiDoc;

export const guestMenusTableTentApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/{menuId}/export/table-tent.pdf',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GUEST_MENUS_READ',
      tags: [ApiTags.guestMenusContent],
      summary: 'Table tent QR card (PDF)',
      description: 'Printable A6/A5 card with bar name/logo, localized "Our menu" text and a large QR code.',
      params: GuestMenuItemParams,
      query: GuestMenuTableTentQuerySchema,
      rawResponse: { contentTypes: ['application/pdf'], description: 'The generated PDF document.' },
      errorResponses: PDF_ERRORS,
    },
  },
} satisfies ResourceApiDoc;

// Bartender view: cocktails only on the guest menu ---------------------------

export const GuestMenuExtrasQuerySchema = z.object({
  cardId: z.string().min(1).openapi({ description: 'Bartender card currently shown.' }),
});

export const GuestMenuExtrasDtoSchema = z
  .object({
    menus: z.array(z.object({ id: z.string(), name: z.string() })).openapi({ description: 'Active guest menu(s) used for the comparison.' }),
    cocktailIds: z.array(z.string()).openapi({ description: 'Cocktails on the active guest menu but not on the card (menu order).' }),
  })
  .openapi('GuestMenuExtras');
export type GuestMenuExtrasDto = z.infer<typeof GuestMenuExtrasDtoSchema>;

export const guestMenusActiveExtrasApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-menus/active/extras',
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.guestMenusCore],
      summary: 'Cocktails only on the active guest menu',
      description:
        'Cocktails shown on the currently active (published, scheduled) guest menu that are not on the given bartender card – for the "only on guest menu" group in the bartender view.',
      params: WorkspaceIdParam,
      query: GuestMenuExtrasQuerySchema,
      response: GuestMenuExtrasDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
