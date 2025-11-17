import { CocktailRecipeModel } from '../models/CocktailRecipeModel';
import { normalizeString } from '../lib/StringUtils';

export const cocktailFilter = (filterString: string) => {
  const filterFor = normalizeString(filterString);

  return function (cocktailRecipe: CocktailRecipeModel): boolean {
    return (
      normalizeString(cocktailRecipe.name).includes(filterFor) ||
      normalizeString(cocktailRecipe.glass?.name).includes(filterFor) ||
      cocktailRecipe.garnishes.some((garnish) => normalizeString(garnish.garnish.name).includes(filterFor)) ||
      cocktailRecipe.tags.some((tag) => normalizeString(tag).includes(filterFor))
    );
  };
};
