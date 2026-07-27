/**
 * Prisma → public DTO mapping for cocktail-recipe step actions. Drops `workspaceId`
 * (implied by the path); the shape is already flat.
 */
import type { WorkspaceCocktailRecipeStepAction } from '@generated/prisma/client';
import type { ActionDto } from '@lib/schemas/actions';

export function toActionDto(action: Pick<WorkspaceCocktailRecipeStepAction, 'id' | 'name' | 'actionGroup'>): ActionDto {
  return { id: action.id, name: action.name, actionGroup: action.actionGroup };
}
