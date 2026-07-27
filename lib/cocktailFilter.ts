import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { normalizeString } from '../lib/StringUtils';

/**
 * Client-side filter for the manage cocktails list. Operates on the v1 `CocktailSummaryDto`; the
 * garnish/ingredient name arrays are only present when the list was fetched with
 * `?include=garnishes,ingredients` (see manage/cocktails/index.tsx).
 */
export const cocktailFilter = (filterString: string) => {
  const filterFor = normalizeString(filterString);

  return function (cocktailRecipe: CocktailSummaryDto): boolean {
    const isLongSearch = filterFor.length >= 3;

    return (
      normalizeString(cocktailRecipe.name).includes(filterFor) ||
      (normalizeString(cocktailRecipe.glass?.name).includes(filterFor) && isLongSearch) ||
      ((cocktailRecipe.garnishes ?? []).some((garnish) => normalizeString(garnish.name).includes(filterFor)) && isLongSearch) ||
      (cocktailRecipe.tags.some((tag) => normalizeString(tag).includes(filterFor)) && isLongSearch) ||
      (cocktailRecipe.ingredients ?? []).some(
        (ingredient) =>
          (normalizeString(ingredient.name).includes(filterFor) && isLongSearch) ||
          (normalizeString(ingredient.shortName ?? undefined).includes(filterFor) && isLongSearch),
      )
    );
  };
};
