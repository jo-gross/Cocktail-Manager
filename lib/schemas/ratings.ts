/**
 * Zod schemas + ResourceApiDocs for the Ratings resource (v1), nested under
 * cocktails. Pure module (zod + type-only enums) so scripts/generate-openapi.ts
 * can import it without pulling the Prisma runtime. Responses describe the clean
 * public DTO (see lib/api/dto/ratings.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { DateTimeString, WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public rating DTO — no Prisma-isms: no `cocktailId` (implied by the path). */
export const RatingDtoSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().openapi({ description: 'Name of the rater, or null.' }),
    rating: z.number().int().openapi({ description: 'Rating value.' }),
    comment: z.string().nullable().openapi({ description: 'Optional comment.' }),
    createdAt: DateTimeString,
  })
  .openapi('Rating');

export type RatingDto = z.infer<typeof RatingDtoSchema>;

export const RatingCreateSchema = z
  .object({
    name: z.string().trim().max(100).nullish().openapi({ description: 'Name of the rater (max. 100 characters).' }),
    rating: z.coerce.number().int().min(1).max(5).openapi({ description: 'Rating value (1–5).' }),
    comment: z.string().trim().max(2_000).nullish().openapi({ description: 'Optional comment (max. 2000 characters).' }),
  })
  .openapi('RatingCreateInput');

export type RatingCreateInput = z.infer<typeof RatingCreateSchema>;

export const RatingCollectionParams = WorkspaceIdParam.extend({ cocktailId: z.string().max(64) });
export const RatingItemParams = WorkspaceIdParam.extend({ cocktailId: z.string().max(64), ratingId: z.string().max(64) });

export const ratingsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'RATINGS_READ',
      tags: [ApiTags.ratingsCore],
      summary: 'List ratings',
      description: 'List all ratings of a cocktail (newest first).',
      params: RatingCollectionParams,
      response: z.array(RatingDtoSchema),
      errorResponses: { 404: 'Cocktail not found.' },
    },
    POST: {
      roles: ['USER'],
      permission: 'RATINGS_CREATE',
      tags: [ApiTags.ratingsCore],
      summary: 'Create rating',
      params: RatingCollectionParams,
      body: RatingCreateSchema,
      response: RatingDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const ratingsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings/{ratingId}',
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'RATINGS_DELETE',
      tags: [ApiTags.ratingsCore],
      summary: 'Delete rating',
      params: RatingItemParams,
      response: RatingDtoSchema,
      errorResponses: { 404: 'Rating not found.' },
    },
  },
} satisfies ResourceApiDoc;
