/**
 * Zod schemas + ResourceApiDocs for the guide progress (tours, checklists) of the
 * session user (docs/plans/ONBOARDING-PLAN.md §3). Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { DateTimeString } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const GuideStatusEnum = z.enum(['STARTED', 'COMPLETED', 'DISMISSED']).openapi('GuideStatus');

export const GuideIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/, 'Letters, digits, ":", ".", "_" and "-" only')
  .openapi({ description: 'Guide id, e.g. `tour:basics-bar` or `checklist:<workspaceId>`.', example: 'tour:basics-bar' });

export const GuideIdParam = z.object({ guideId: GuideIdSchema });

export const GuideProgressDtoSchema = z
  .object({
    guideId: z.string(),
    status: GuideStatusEnum,
    version: z.number().int().openapi({ description: 'Version of the guide the status refers to.' }),
    updatedAt: DateTimeString,
  })
  .openapi('GuideProgress');

export const GuideProgressUpdateSchema = z
  .object({
    status: GuideStatusEnum,
    version: z.number().int().min(1).max(100_000),
  })
  .openapi('GuideProgressUpdateInput');

export type GuideProgressDto = z.infer<typeof GuideProgressDtoSchema>;
export type GuideProgressUpdateInput = z.infer<typeof GuideProgressUpdateSchema>;

export const guidesCollectionApiDoc = {
  basePath: '/me/guides',
  operations: {
    GET: {
      roles: ['USER'],
      permission: null,
      auth: 'user',
      sessionOnly: true,
      tags: [ApiTags.userGuides],
      summary: 'List guide progress',
      description: 'Progress of all tours and checklists of the session user.',
      response: z.array(GuideProgressDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const guidesItemApiDoc = {
  basePath: '/me/guides/{guideId}',
  operations: {
    PUT: {
      roles: ['USER'],
      permission: null,
      auth: 'user',
      sessionOnly: true,
      tags: [ApiTags.userGuides],
      summary: 'Set guide progress',
      description: 'Creates or updates the status of a guide for the session user.',
      params: GuideIdParam,
      body: GuideProgressUpdateSchema,
      response: GuideProgressDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
