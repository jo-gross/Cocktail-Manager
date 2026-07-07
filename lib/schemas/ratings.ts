/**
 * Zod schemas + ResourceApiDocs for the Ratings resource (v1), nested under
 * cocktails. Pure module (zod + type-only enums) so scripts/generate-openapi.ts
 * can import it without pulling the Prisma runtime. Responses describe the clean
 * public DTO (see lib/api/dto/ratings.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { DateTimeString, WorkspaceIdParam } from '@lib/schemas/common';
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
    name: z.string().nullish().openapi({ description: 'Name of the rater.' }),
    rating: z.coerce.number().int().openapi({ description: 'Rating value.' }),
    comment: z.string().nullish().openapi({ description: 'Optional comment.' }),
  })
  .openapi('RatingCreateInput');

export type RatingCreateInput = z.infer<typeof RatingCreateSchema>;

export const RatingCollectionParams = WorkspaceIdParam.extend({ cocktailId: z.string() });
export const RatingItemParams = WorkspaceIdParam.extend({ cocktailId: z.string(), ratingId: z.string() });

export const ratingsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'RATINGS_READ',
      tags: ['Ratings'],
      summary: 'List ratings',
      description: 'List all ratings of a cocktail.',
      params: RatingCollectionParams,
      response: z.array(RatingDtoSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'RATINGS_CREATE',
      tags: ['Ratings'],
      summary: 'Create rating',
      params: RatingCollectionParams,
      body: RatingCreateSchema,
      response: RatingDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const ratingsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings/{ratingId}',
  legacyPath: true,
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'RATINGS_DELETE',
      tags: ['Ratings'],
      summary: 'Delete rating',
      params: RatingItemParams,
      response: RatingDtoSchema,
      errorResponses: { 404: 'Rating not found.' },
    },
  },
} satisfies ResourceApiDoc;
