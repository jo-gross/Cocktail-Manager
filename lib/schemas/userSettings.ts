/**
 * Zod schema + ResourceApiDoc for session user settings (v1).
 * Pure module (zod only). Mirrors Prisma `Setting` enum values.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Known user setting keys (mirrors Prisma Setting). */
export const UserSettingKeyEnum = z
  .enum([
    'showImage',
    'showTags',
    'lessItems',
    'theme',
    'language',
    'showStatisticActions',
    'lastSeenVersion',
    'showNotes',
    'showHistory',
    'showDescription',
    'showTime',
    'showRating',
    'queueGrouping',
    'showFastQueueCheck',
    'showSettingsAtBottom',
  ])
  .openapi('UserSettingKey');

export const UserSettingUpdateSchema = z
  .object({
    setting: UserSettingKeyEnum,
    value: z.string().nullable().openapi({ description: 'Setting value as string, or null to clear.' }),
  })
  .openapi('UserSettingUpdateInput');

export type UserSettingUpdateInput = z.infer<typeof UserSettingUpdateSchema>;

export const UserSettingDtoSchema = z
  .object({
    userId: z.string(),
    setting: UserSettingKeyEnum,
    value: z.string().nullable(),
  })
  .openapi('UserSetting');

export type UserSettingDto = z.infer<typeof UserSettingDtoSchema>;

export const userSettingsApiDoc = {
  basePath: '/users/settings',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['USER'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.userSettings],
      summary: 'Upsert a user setting',
      description: 'Creates or updates a setting for the authenticated session user. Session-only — API keys are not accepted.',
      body: UserSettingUpdateSchema,
      response: UserSettingDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
