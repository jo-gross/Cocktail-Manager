/**
 * Prisma → public DTO mapping for cards (cocktail cards / menus). Keeps the
 * /api/v1 contract clean: PascalCase relations `CocktailCardGroup`/
 * `CocktailCardGroupItem` become camelCase `groups`/`items`, the item's
 * `cocktailId` + relation collapse to a slim `cocktail: { id, name }` ref, dates
 * serialize to ISO strings and `workspaceId` is dropped (implied by the path).
 */
import type { CocktailCard, CocktailCardGroup, CocktailCardGroupItem, CocktailRecipe } from '@generated/prisma/client';
import type { CardDto, CardSummaryDto } from '@lib/schemas/cards';

type ItemWithCocktail = Pick<CocktailCardGroupItem, 'itemNumber' | 'specialPrice'> & {
  cocktail: Pick<CocktailRecipe, 'id' | 'name'>;
};

type GroupWithItems = Pick<CocktailCardGroup, 'id' | 'name' | 'groupNumber' | 'groupPrice'> & {
  items: ItemWithCocktail[];
};

type CardWithGroups = Pick<CocktailCard, 'id' | 'name' | 'date' | 'archived'> & {
  groups: GroupWithItems[];
};

/** Slim summary for list views — no nested groups. */
export function toCardSummaryDto(card: Pick<CocktailCard, 'id' | 'name' | 'date' | 'archived'>): CardSummaryDto {
  return {
    id: card.id,
    name: card.name,
    date: card.date ? card.date.toISOString() : null,
    archived: card.archived,
  };
}

/** Full card with nested groups and items. */
export function toCardDto(card: CardWithGroups): CardDto {
  return {
    ...toCardSummaryDto(card),
    groups: card.groups.map((group) => ({
      id: group.id,
      name: group.name,
      groupNumber: group.groupNumber,
      groupPrice: group.groupPrice,
      items: group.items.map((item) => ({
        cocktail: { id: item.cocktail.id, name: item.cocktail.name },
        itemNumber: item.itemNumber,
        specialPrice: item.specialPrice,
      })),
    })),
  };
}
