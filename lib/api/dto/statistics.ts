/**
 * Prisma → public DTO mapping for cocktail statistics. Keeps the /api/v1 contract
 * clean: ISO timestamps, no `workspaceId`/raw FKs (`cocktailId`/`userId`/…), and
 * the cocktail/card/user relations flattened to slim `{ id, name }` refs.
 */
import type { CocktailCard, CocktailRecipe, CocktailStatisticItem, User } from '@generated/prisma/client';
import type { CocktailStatisticItemDto } from '@lib/schemas/statistics';

type CocktailStatisticItemWithRefs = Pick<CocktailStatisticItem, 'id' | 'date' | 'actionSource'> & {
  cocktail: Pick<CocktailRecipe, 'id' | 'name'>;
  cocktailCard: Pick<CocktailCard, 'id' | 'name'> | null;
  user: Pick<User, 'id' | 'name'> | null;
};

export function toCocktailStatisticItemDto(item: CocktailStatisticItemWithRefs): CocktailStatisticItemDto {
  return {
    id: item.id,
    date: item.date.toISOString(),
    actionSource: item.actionSource,
    cocktail: { id: item.cocktail.id, name: item.cocktail.name },
    cocktailCard: item.cocktailCard ? { id: item.cocktailCard.id, name: item.cocktailCard.name } : null,
    user: item.user ? { id: item.user.id, name: item.user.name } : null,
  };
}
