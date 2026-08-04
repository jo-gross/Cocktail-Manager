/**
 * Zod schemas + ResourceApiDocs for the Queue resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/queue.ts), NOT the raw Prisma shape.
 *
 * Queue uses action-style paths (`/queue/add`, `/queue/remove`) mirrored 1:1
 * from the legacy handlers.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Lean cocktail reference embedded in a queue item — id + name only, no nesting. */
export const QueueCocktailRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('QueueCocktailRef');

/** Public queue item DTO — no Prisma-isms and no `workspaceId` (implied by the path). */
export const QueueItemDtoSchema = z
  .object({
    id: z.string(),
    cocktail: QueueCocktailRefSchema,
    notes: z.string().nullable(),
    inProgress: z.boolean(),
    createdAt: DateTimeString,
  })
  .openapi('QueueItem');

export type QueueItemDto = z.infer<typeof QueueItemDtoSchema>;

export const QueueAddSchema = z
  .object({
    cocktailId: z.string().min(1),
    notes: z.string().nullish().openapi({ description: 'Optional notes. Empty or "-" is treated as no notes.' }),
    amount: z.coerce.number().int().min(1).optional().openapi({ description: 'How many identical items to enqueue (default 1).' }),
  })
  .openapi('QueueAddInput');

export const QueueRemoveSchema = z
  .object({
    cocktailId: z.string().min(1),
    notes: z.string().nullish().openapi({ description: 'Notes to match. Empty or "-" matches items without notes.' }),
  })
  .openapi('QueueRemoveInput');

export const QueueUpdateSchema = z
  .object({
    inProgress: z.boolean().openapi({ description: 'Whether the queue item is currently being prepared.' }),
  })
  .openapi('QueueUpdateInput');

export const QueueItemParams = WorkspaceIdParam.extend({ queueItemId: z.string() });

export type QueueAddInput = z.infer<typeof QueueAddSchema>;
export type QueueRemoveInput = z.infer<typeof QueueRemoveSchema>;
export type QueueUpdateInput = z.infer<typeof QueueUpdateSchema>;

export const queueCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/queue',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'QUEUE_READ',
      tags: [ApiTags.queueCore],
      summary: 'List queue',
      description: 'List all cocktail queue items of a workspace.',
      params: WorkspaceIdParam,
      response: z.array(QueueItemDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const queueAddApiDoc = {
  basePath: '/workspaces/{workspaceId}/queue/add',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'QUEUE_CREATE',
      tags: [ApiTags.queueCore],
      summary: 'Add to queue',
      description: 'Enqueue one or more identical cocktail queue items.',
      params: WorkspaceIdParam,
      body: QueueAddSchema,
      response: z.array(QueueItemDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const queueRemoveApiDoc = {
  basePath: '/workspaces/{workspaceId}/queue/remove',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'QUEUE_DELETE',
      tags: [ApiTags.queueCore],
      summary: 'Remove from queue',
      description: 'Remove the oldest queue item matching the given cocktail and notes.',
      params: WorkspaceIdParam,
      body: QueueRemoveSchema,
      response: QueueItemDtoSchema,
      errorResponses: { 404: 'No matching cocktail in queue.' },
    },
  },
} satisfies ResourceApiDoc;

export const queueItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/queue/{queueItemId}',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['USER'],
      permission: 'QUEUE_UPDATE',
      tags: [ApiTags.queueCore],
      summary: 'Update queue item',
      description: 'Update the in-progress state of a queue item.',
      params: QueueItemParams,
      body: QueueUpdateSchema,
      response: QueueItemDtoSchema,
      errorResponses: { 404: 'Queue item not found.' },
    },
  },
} satisfies ResourceApiDoc;
