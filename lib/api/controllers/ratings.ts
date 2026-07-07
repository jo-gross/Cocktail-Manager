/**
 * Version-agnostic business logic for ratings (v1). Same DB operations as the
 * legacy handlers, but returns clean public DTOs (lib/api/dto/ratings.ts).
 * Legacy routes remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toRatingDto } from '@lib/api/dto/ratings';
import type { Workspace } from '@generated/prisma/client';
import type { RatingCreateInput, RatingDto } from '@lib/schemas/ratings';

export async function listRatings(cocktailId: string): Promise<RatingDto[]> {
  const ratings = await prisma.cocktailRating.findMany({
    where: { cocktailId },
  });
  return ratings.map(toRatingDto);
}

export async function createRating(cocktailId: string, input: RatingCreateInput): Promise<RatingDto> {
  const created = await prisma.cocktailRating.create({
    data: {
      name: input.name ?? undefined,
      rating: input.rating,
      comment: input.comment ?? undefined,
      cocktail: { connect: { id: cocktailId } },
    },
  });
  return toRatingDto(created);
}

export async function deleteRating(workspace: Workspace, ratingId: string): Promise<RatingDto> {
  // Verify that the rating belongs to a cocktail in this workspace.
  const rating = await prisma.cocktailRating.findFirst({
    where: {
      id: ratingId,
      cocktail: { workspaceId: workspace.id },
    },
  });
  if (!rating) throw new ApiError(404, 'NOT_FOUND', 'Rating not found');

  const deleted = await prisma.cocktailRating.delete({ where: { id: ratingId } });
  return toRatingDto(deleted);
}
