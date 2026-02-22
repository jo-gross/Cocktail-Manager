import { CocktailRecipeModel } from '../models/CocktailRecipeModel';
import { normalizeString } from '../lib/StringUtils';

export const cocktailFilter = (filterString: string) => {
  const filterFor = normalizeString(filterString);

  return function (cocktailRecipe: CocktailRecipeModel): boolean {
    const isLongSearch = filterFor.length >= 3;

    return (
      normalizeString(cocktailRecipe.name).includes(filterFor) ||
      (normalizeString(cocktailRecipe.glass?.name).includes(filterFor) && isLongSearch) ||
      (cocktailRecipe.garnishes.some((garnish) => normalizeString(garnish.garnish.name).includes(filterFor)) && isLongSearch) ||
      (cocktailRecipe.tags.some((tag) => normalizeString(tag).includes(filterFor)) && isLongSearch) ||
      (cocktailRecipe.steps ?? []).some((step) =>
        step.ingredients.some(
          (ingredient) =>
            (normalizeString(ingredient.ingredient?.name).includes(filterFor) && isLongSearch) ||
            (normalizeString(ingredient.ingredient?.shortName ?? undefined).includes(filterFor) && isLongSearch),
        ),
      )
    );
  };
};
