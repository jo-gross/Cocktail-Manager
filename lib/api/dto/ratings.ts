/**
 * Prisma → public DTO mapping for ratings. Keeps the /api/v1 contract clean:
 * no `cocktailId` (already implied by the path) and serializes `createdAt` as
 * an ISO string.
 */
import type { CocktailRating } from '@generated/prisma/client';
import type { RatingDto } from '@lib/schemas/ratings';

export function toRatingDto(rating: Pick<CocktailRating, 'id' | 'name' | 'rating' | 'comment' | 'createdAt'>): RatingDto {
  return {
    id: rating.id,
    name: rating.name,
    rating: rating.rating,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
  };
}
