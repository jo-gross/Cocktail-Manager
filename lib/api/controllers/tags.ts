/**
 * Version-agnostic business logic for tags (v1). Same DB operations as the
 * legacy handler: aggregate the distinct tag strings across cocktails and
 * ingredients of a workspace.
 */
import prisma from '../../../prisma/prisma';
import '@lib/ArrayUtils';
import type { Workspace } from '@generated/prisma/client';
import type { TagsDto } from '@lib/schemas/tags';

export async function listTags(workspace: Workspace): Promise<TagsDto> {
  const cocktailTags = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    select: { tags: true },
  });

  const ingredientTags = await prisma.ingredient.findMany({
    where: { workspaceId: workspace.id },
    select: { tags: true },
  });

  return [...cocktailTags, ...ingredientTags]
    .map((tag) => tag.tags)
    .flat()
    .filterUnique();
}
