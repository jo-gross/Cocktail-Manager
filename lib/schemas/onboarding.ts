/**
 * Zod schemas + ResourceApiDocs for the setup state and checklist of a workspace
 * (docs/plans/ONBOARDING-PLAN.md §2/§4). Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { DateTimeString, WorkspaceIdParam } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { ONBOARDING_CHECKLIST_ITEMS } from '@lib/onboarding/checklistItems';

export { ONBOARDING_CHECKLIST_ITEMS };

export const OnboardingChecklistItemIdEnum = z.enum(ONBOARDING_CHECKLIST_ITEMS).openapi('OnboardingChecklistItemId', {
  description:
    '`glasses`/`ingredients`/`cocktails`/`cards`: at least one exists, `prices`: every active cocktail has a price, `guestInfo`: guest information of all ingredients and garnishes is confirmed, `team`: more than one member or a join code, `guestMenu`: a published, enabled guest menu.',
});

export const OnboardingChecklistItemSchema = z
  .object({
    id: OnboardingChecklistItemIdEnum,
    done: z.boolean().openapi({ description: 'The condition is met by the data of the workspace.' }),
    skipped: z.boolean().openapi({ description: 'A manager marked the item as done without doing it. Progress counts `done || skipped`.' }),
    /** Items that still need work (e.g. cocktails without price); 0 when done. */
    open: z.number().int().openapi({ description: 'Items that still need work (e.g. cocktails without price); 0 when done.' }),
  })
  .openapi('OnboardingChecklistItem');

export const OnboardingDtoSchema = z
  .object({
    setupCompletedAt: DateTimeString.nullable().openapi({ description: 'When the setup assistant was completed; null = not yet.' }),
    checklist: z.array(OnboardingChecklistItemSchema),
  })
  .openapi('Onboarding');

export const OnboardingChecklistItemParams = WorkspaceIdParam.extend({ itemId: OnboardingChecklistItemIdEnum });

export const OnboardingChecklistItemUpdateSchema = z
  .object({
    skipped: z.boolean().openapi({ description: 'true marks the item as done without doing it, false reverts that.' }),
  })
  .openapi('OnboardingChecklistItemUpdateInput');

export type OnboardingChecklistItemUpdateInput = z.infer<typeof OnboardingChecklistItemUpdateSchema>;
export type OnboardingChecklistItemId = z.infer<typeof OnboardingChecklistItemIdEnum>;
export type OnboardingChecklistItem = z.infer<typeof OnboardingChecklistItemSchema>;
export type OnboardingDto = z.infer<typeof OnboardingDtoSchema>;

export const onboardingApiDoc = {
  basePath: '/workspaces/{workspaceId}/onboarding',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.onboardingCore],
      summary: 'Get setup state and checklist',
      description: 'Setup state of the workspace and the checklist computed from its data.',
      params: WorkspaceIdParam,
      response: OnboardingDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const onboardingCompleteApiDoc = {
  basePath: '/workspaces/{workspaceId}/onboarding/complete',
  operations: {
    POST: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.onboardingCore],
      summary: 'Complete setup',
      description: 'Marks the setup assistant as completed (idempotent: keeps the first completion time).',
      params: WorkspaceIdParam,
      response: OnboardingDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const onboardingChecklistItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/onboarding/checklist/{itemId}',
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.onboardingCore],
      summary: 'Mark checklist item as done',
      description:
        'Marks a checklist item as done without doing it (`skipped: true`, e.g. a bar that does not want a guest menu) or reverts that. Applies to the whole workspace; idempotent. Stored in the workspace setting `onboardingChecklistSkipped`.',
      params: OnboardingChecklistItemParams,
      body: OnboardingChecklistItemUpdateSchema,
      response: OnboardingDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
