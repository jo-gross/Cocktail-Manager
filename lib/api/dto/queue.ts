/**
 * Prisma → public DTO mapping for queue items. Keeps the /api/v1 contract clean:
 * no `workspaceId` (already implied by the path), a lean `cocktail` reference
 * ({ id, name }) instead of an embedded relation, and an ISO `createdAt`.
 */
import type { CocktailQueue, CocktailRecipe } from '@generated/prisma/client';
import type { QueueItemDto } from '@lib/schemas/queue';

type QueueItemWithCocktail = Pick<CocktailQueue, 'id' | 'notes' | 'inProgress' | 'createdAt'> & {
  cocktail: Pick<CocktailRecipe, 'id' | 'name'>;
};

export function toQueueItemDto(item: QueueItemWithCocktail): QueueItemDto {
  return {
    id: item.id,
    cocktail: { id: item.cocktail.id, name: item.cocktail.name },
    notes: item.notes,
    inProgress: item.inProgress,
    createdAt: item.createdAt.toISOString(),
  };
}
