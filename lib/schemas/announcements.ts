/**
 * Zod schemas + ResourceApiDocs of the control plane announcements: the push of the instance API
 * (`PUT /api/v1/instance/announcements`, master key only) and the two reads of the banner in the app.
 * The push follows the contract `contracts/instance-api.openapi.yaml` of the control plane; see docs/INSTANCE-API.md.
 * Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { DateTimeString, WorkspaceIdParam } from '@lib/schemas/common';
import { instanceWriteOperation } from '@lib/schemas/instance';
import { ANNOUNCEMENT_LEVELS } from '@lib/announcements/text';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const MAX_ANNOUNCEMENTS = 50;
export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 200;
export const MAX_ANNOUNCEMENT_BODY_LENGTH = 2000;
export const MAX_ANNOUNCEMENT_WORKSPACES = 1000;
/** `LocalizedText` of the contract: both languages required and not empty. */
const localizedText = (maxLength: number) => z.object({ de: z.string().trim().min(1).max(maxLength), en: z.string().trim().min(1).max(maxLength) });

const IsoDateTime = z.iso.datetime({ offset: true });

export const AnnouncementInputSchema = z
  .object({
    id: z.string().min(1).max(128).openapi({ description: 'Id of the announcement in the control plane; unique within the set.' }),
    level: z.enum(ANNOUNCEMENT_LEVELS).openapi({ description: 'Severity. Users can dismiss `info` announcements.', example: 'info' }),
    title: localizedText(MAX_ANNOUNCEMENT_TITLE_LENGTH).optional().openapi({ description: 'Title per language; shown in the language of the user.' }),
    body: localizedText(MAX_ANNOUNCEMENT_BODY_LENGTH).openapi({
      description: 'Text per language; shown in the language of the user.',
      example: { de: 'Wartung am Sonntag ab 22 Uhr.', en: 'Maintenance on Sunday from 10 pm.' },
    }),
    startsAt: IsoDateTime.optional().openapi({ description: 'Shown from this time on; without it immediately.' }),
    endsAt: IsoDateTime.optional().openapi({ description: 'Shown until this time (exclusive); without it until it is replaced.' }),
    workspaceIds: z
      .array(z.string().min(1).max(128))
      .max(MAX_ANNOUNCEMENT_WORKSPACES)
      .openapi({ description: 'Targeted workspaces; an empty array means all workspaces. Unknown ids are stored and match nothing.' }),
  })
  .refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .openapi('InstanceAnnouncementInput');

export const AnnouncementsPutInputSchema = z
  .object({
    announcements: z
      .array(AnnouncementInputSchema)
      .max(MAX_ANNOUNCEMENTS)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Announcement ids must be unique'),
  })
  .openapi('InstanceAnnouncementsInput');

export const AnnouncementsPutResultSchema = z.object({ count: z.number().int().min(0) }).openapi('InstanceAnnouncementsResult');

const AnnouncementTextSchema = z.object({ de: z.string(), en: z.string() }).openapi('AnnouncementText');

export const AnnouncementDtoSchema = z
  .object({
    id: z.string(),
    level: z.enum(ANNOUNCEMENT_LEVELS),
    title: AnnouncementTextSchema.nullable(),
    body: AnnouncementTextSchema,
    dismissible: z.boolean().openapi({ description: 'True for `info` announcements.' }),
    revision: z.string().openapi({ description: 'Changes when level, texts or time window change; dismissals are stored per id and revision.' }),
    endsAt: DateTimeString.nullable(),
  })
  .openapi('Announcement');

export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;
export type AnnouncementsPutInput = z.infer<typeof AnnouncementsPutInputSchema>;
export type AnnouncementDto = z.infer<typeof AnnouncementDtoSchema>;

export const instanceAnnouncementsApiDoc = {
  basePath: '/instance/announcements',
  operations: {
    PUT: {
      ...instanceWriteOperation,
      tags: [ApiTags.instanceAnnouncements],
      summary: 'Replace the instance announcements',
      description:
        'Replaces the full set of announcements shown as banners in the app; an empty array removes all. Each announcement has a level, a text ' +
        'in German and English, an optional time window and its target: all workspaces or the listed ones. Capability `announcements`.',
      body: AnnouncementsPutInputSchema,
      response: AnnouncementsPutResultSchema,
      errorResponses: { 409: 'The Idempotency-Key was already used for another request.' },
    },
  },
} satisfies ResourceApiDoc;

export const announcementsCollectionApiDoc = {
  basePath: '/announcements',
  operations: {
    GET: {
      roles: ['USER'],
      permission: null,
      auth: 'user',
      sessionOnly: true,
      tags: [ApiTags.userAnnouncements],
      summary: 'List active announcements for all workspaces',
      description:
        'Announcements of the hosting provider that are active now and target all workspaces (shown on the workspace overview). ' +
        'Always empty on self-hosted instances.',
      response: z.array(AnnouncementDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const workspaceAnnouncementsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/announcements',
  operations: {
    GET: {
      roles: ['USER'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.userAnnouncements],
      summary: 'List active announcements for a workspace',
      description:
        'Announcements of the hosting provider that are active now and target all workspaces or this workspace. Always empty on self-hosted instances.',
      params: WorkspaceIdParam,
      response: z.array(AnnouncementDtoSchema),
    },
  },
} satisfies ResourceApiDoc;
