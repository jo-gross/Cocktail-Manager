/**
 * Zod schemas + ResourceApiDocs for the Monitor/Signage resource (v1).
 * Pure module (zod + type-only imports). Slides expose `imageUrl` (a bytes
 * endpoint) instead of the raw base64 `content`, consistent with other images.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const MonitorFormatEnum = z.enum(['LANDSCAPE', 'PORTRAIT']).openapi('MonitorFormat');
export const SignageBackgroundModeEnum = z.enum(['COLOR', 'BLURRED']).openapi('SignageBackgroundMode');
export const SignageSlideTypeEnum = z.enum(['IMAGE', 'GUEST_MENU']).openapi('SignageSlideType');

/** Per-slide overrides for `GUEST_MENU` slides; `null`/missing = use the menu's `outputs.monitor` setting. */
export const GuestMenuSlideOptionsSchema = z
  .object({
    localeMode: z.enum(['primary', 'fixed', 'rotate']).nullish().openapi({ description: '`rotate` alternates the menu languages per page cycle.' }),
    locale: z.string().max(16).nullish().openapi({ description: 'Content locale for `localeMode: fixed`.' }),
    showQrCode: z.boolean().nullish(),
    columns: z
      .union([z.literal('auto'), z.number().int().min(1).max(6)])
      .nullish()
      .openapi({ description: '`auto` picks the column count (and font scale) that fits best.' }),
    pageDurationSeconds: z.number().int().min(3).max(600).nullish().openapi({ description: 'Seconds per page when the menu needs several pages.' }),
  })
  .openapi('GuestMenuSlideOptions');
export type GuestMenuSlideOptionsInput = z.infer<typeof GuestMenuSlideOptionsSchema>;

export const SignageSlideDtoSchema = z
  .object({
    id: z.string(),
    order: z.number().int(),
    enabled: z.boolean(),
    weekdays: z.array(z.number().int()).openapi({ description: 'Active weekdays (0=Sun … 6=Sat); empty = every day.' }),
    validFrom: z.string().nullable().openapi({ description: 'Active-from date (YYYY-MM-DD), or null.' }),
    validTo: z.string().nullable().openapi({ description: 'Active-to date (YYYY-MM-DD), or null.' }),
    dateExclusive: z.boolean(),
    type: SignageSlideTypeEnum,
    imageUrl: z.string().nullable().openapi({ description: 'URL to fetch the slide image bytes (IMAGE slides), null for GUEST_MENU slides.' }),
    guestMenuId: z.string().nullable().openapi({ description: 'GUEST_MENU slides: the shown menu, or null for the currently active menu.' }),
    guestMenuName: z.string().nullable().openapi({ description: 'Name of `guestMenuId`, if set.' }),
    options: GuestMenuSlideOptionsSchema.nullable(),
  })
  .openapi('SignageSlide');
export type SignageSlideDto = z.infer<typeof SignageSlideDtoSchema>;

export const SignageFormatDtoSchema = z
  .object({
    format: MonitorFormatEnum,
    backgroundColor: z.string().nullable(),
    backgroundMode: SignageBackgroundModeEnum,
    slideDurationSeconds: z.number().int(),
    mirrorSourceFormat: MonitorFormatEnum.nullable().openapi({ description: 'If set, this format mirrors the slides of the given source format.' }),
    slides: z.array(SignageSlideDtoSchema),
  })
  .openapi('SignageFormat');
export type SignageFormatDto = z.infer<typeof SignageFormatDtoSchema>;

export const SignageFormatSettingsSchema = z.object({
  backgroundColor: z.string().nullish(),
  backgroundMode: SignageBackgroundModeEnum.optional(),
  slideDurationSeconds: z.coerce.number().int(),
  mirrorSourceFormat: MonitorFormatEnum.nullish(),
  slides: z.array(z.object({ id: z.string(), order: z.coerce.number().int() }).openapi('SignageSlideOrder')),
});
export type SignageFormatSettingsInput = z.infer<typeof SignageFormatSettingsSchema>;

export const SignageSettingsUpdateSchema = z
  .object({
    landscape: SignageFormatSettingsSchema.optional(),
    portrait: SignageFormatSettingsSchema.optional(),
  })
  .openapi('SignageSettingsUpdateInput');
export type SignageSettingsUpdateInput = z.infer<typeof SignageSettingsUpdateSchema>;

export const SignageSlideCreateSchema = z
  .object({
    format: MonitorFormatEnum,
    slides: z.array(z.string()).min(1).openapi({ description: 'Base64-encoded slide images (data URIs) to append.' }),
  })
  .openapi('SignageSlideCreateInput');
export type SignageSlideCreateInput = z.infer<typeof SignageSlideCreateSchema>;

export const SignageGuestMenuSlideCreateSchema = z
  .object({
    format: MonitorFormatEnum,
    guestMenuId: z.string().nullable().openapi({ description: 'Menu to show; null = the currently active guest menu.' }),
    options: GuestMenuSlideOptionsSchema.nullish(),
  })
  .openapi('SignageGuestMenuSlideCreateInput');
export type SignageGuestMenuSlideCreateInput = z.infer<typeof SignageGuestMenuSlideCreateSchema>;

export const SignageGuestMenuSlideUpdateSchema = z
  .object({
    guestMenuId: z.string().nullable().optional().openapi({ description: 'Menu to show; null = the currently active guest menu.' }),
    options: GuestMenuSlideOptionsSchema.nullish(),
  })
  .openapi('SignageGuestMenuSlideUpdateInput');
export type SignageGuestMenuSlideUpdateInput = z.infer<typeof SignageGuestMenuSlideUpdateSchema>;

export const SignageSlidePatchSchema = z
  .object({
    slideIds: z.array(z.string()).min(1),
    enabled: z.boolean().optional(),
    weekdays: z.array(z.number().int()).optional(),
    validFrom: z.string().nullish(),
    validTo: z.string().nullish(),
    dateExclusive: z.boolean().optional(),
  })
  .openapi('SignageSlidePatchInput');
export type SignageSlidePatchInput = z.infer<typeof SignageSlidePatchSchema>;

export const SlideItemParams = WorkspaceIdParam.extend({ slideId: z.string() });

export const signageApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'MONITOR_READ',
      tags: [ApiTags.monitorConfiguration],
      summary: 'Get signage configuration',
      description: 'Signage configuration and slides per format (landscape / portrait).',
      params: WorkspaceIdParam,
      response: z.array(SignageFormatDtoSchema),
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorConfiguration],
      summary: 'Update signage configuration',
      params: WorkspaceIdParam,
      body: SignageSettingsUpdateSchema,
      response: z.array(SignageFormatDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const signageSlidesApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorSlides],
      summary: 'Upload signage slides',
      params: WorkspaceIdParam,
      body: SignageSlideCreateSchema,
      response: z.array(SignageSlideDtoSchema),
      status: 201,
      errorResponses: { 400: 'Invalid slide upload payload.' },
    },
    PATCH: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorSlides],
      summary: 'Update signage slides (schedule / enabled)',
      params: WorkspaceIdParam,
      body: SignageSlidePatchSchema,
      response: z.array(SignageSlideDtoSchema),
      errorResponses: { 400: 'No slide ids or no update fields.', 404: 'Slides not found.', 409: 'Exclusive date ranges overlap.' },
    },
  },
} satisfies ResourceApiDoc;

export const signageSlideItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides/{slideId}',
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorSlides],
      summary: 'Delete signage slide',
      params: SlideItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Slide not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const signageGuestMenuSlidesApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides/guest-menu',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorSlides],
      summary: 'Add a guest menu slide',
      description: 'Appends a `GUEST_MENU` slide that renders a guest menu (or the currently active one) on the monitor.',
      params: WorkspaceIdParam,
      body: SignageGuestMenuSlideCreateSchema,
      response: SignageSlideDtoSchema,
      status: 201,
      errorResponses: { 404: 'Guest menu not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const signageGuestMenuSlideItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides/{slideId}/guest-menu',
  operations: {
    PATCH: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorSlides],
      summary: 'Update a guest menu slide',
      description: 'Changes the menu and/or display options of a `GUEST_MENU` slide.',
      params: SlideItemParams,
      body: SignageGuestMenuSlideUpdateSchema,
      response: SignageSlideDtoSchema,
      errorResponses: { 400: 'Not a guest menu slide.', 404: 'Slide or guest menu not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const signageSlideImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides/{slideId}/image',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'MONITOR_READ',
      tags: [ApiTags.monitorSlides],
      summary: 'Get signage slide image',
      description: 'Returns the slide image bytes (the `imageUrl` target).',
      params: SlideItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The slide image bytes.' },
      errorResponses: { 404: 'Slide not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const SignageKeyDtoSchema = z
  .object({
    key: z.string().nullable().openapi({
      description: 'Monitor key (bearer secret), or null if none was generated yet. Required by monitors to show PIN-protected guest menus.',
    }),
    monitorPath: z.string().openapi({ description: 'Relative monitor URL (`/signage?id=…&key=…`, without `key` if none exists).' }),
  })
  .openapi('SignageKey');
export type SignageKeyDto = z.infer<typeof SignageKeyDtoSchema>;

export const signageKeyApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/key',
  operations: {
    GET: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorConfiguration],
      summary: 'Get the monitor key',
      description:
        'The monitor link `/signage?id={workspaceId}&key={key}` is the only way for a monitor to show PIN-protected guest menus. Without the key, image slides and unprotected menus still work.',
      params: WorkspaceIdParam,
      response: SignageKeyDtoSchema,
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'MONITOR_UPDATE',
      tags: [ApiTags.monitorConfiguration],
      summary: 'Generate / regenerate the monitor key',
      description: 'Creates a new random monitor key. Existing monitor links with the old key can no longer show PIN-protected guest menus.',
      params: WorkspaceIdParam,
      response: SignageKeyDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
