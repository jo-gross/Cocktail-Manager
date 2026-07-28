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

export const SignageSlideDtoSchema = z
  .object({
    id: z.string(),
    order: z.number().int(),
    enabled: z.boolean(),
    weekdays: z.array(z.number().int()).openapi({ description: 'Active weekdays (0=Sun … 6=Sat); empty = every day.' }),
    validFrom: z.string().nullable().openapi({ description: 'Active-from date (YYYY-MM-DD), or null.' }),
    validTo: z.string().nullable().openapi({ description: 'Active-to date (YYYY-MM-DD), or null.' }),
    dateExclusive: z.boolean(),
    imageUrl: z.string().openapi({ description: 'URL to fetch the slide image bytes.' }),
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
  legacyPath: true,
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
  legacyPath: true,
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
  legacyPath: true,
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

export const signageSlideImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/signage/slides/{slideId}/image',
  legacyPath: false,
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
