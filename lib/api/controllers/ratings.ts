/**
 * Business logic for ratings (v1), nested under a cocktail. Ratings have no
 * workspace column, so every query is scoped through the cocktail
 * (`cocktail: { id, workspaceId }`). Returns clean public DTOs (lib/api/dto/ratings.ts).
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { assertInWorkspace } from '@lib/api/scope';
import { toRatingDto } from '@lib/api/dto/ratings';
import type { Workspace } from '@generated/prisma/client';
import type { RatingCreateInput, RatingDto } from '@lib/schemas/ratings';

export async function listRatings(workspace: Workspace, cocktailId: string): Promise<RatingDto[]> {
  await assertInWorkspace(prisma, 'cocktail', cocktailId, workspace.id);
  const ratings = await prisma.cocktailRating.findMany({
    where: { cocktailId, cocktail: { workspaceId: workspace.id } },
    orderBy: { createdAt: 'desc' },
  });
  return ratings.map(toRatingDto);
}

export async function createRating(workspace: Workspace, cocktailId: string, input: RatingCreateInput): Promise<RatingDto> {
  await assertInWorkspace(prisma, 'cocktail', cocktailId, workspace.id);
  const created = await prisma.cocktailRating.create({
    data: {
      name: input.name || undefined,
      rating: input.rating,
      comment: input.comment || undefined,
      cocktailId,
    },
  });
  return toRatingDto(created);
}

export async function deleteRating(workspace: Workspace, cocktailId: string, ratingId: string): Promise<RatingDto> {
  const rating = await prisma.cocktailRating.findFirst({
    where: { id: ratingId, cocktailId, cocktail: { workspaceId: workspace.id } },
  });
  if (!rating) throw new ApiError(404, 'NOT_FOUND', 'Rating not found');

  const deleted = await prisma.cocktailRating.delete({ where: { id: rating.id } });
  return toRatingDto(deleted);
}
