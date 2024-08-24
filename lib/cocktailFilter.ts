import { CocktailRecipeModel } from '../models/CocktailRecipeModel';

export const cocktailFilter = (filterString: string) => {
  const lowerCaseFilterString = filterString.toLowerCase();

  return function (cocktailRecipe: CocktailRecipeModel): boolean {
    return (
      cocktailRecipe.name.toLowerCase().includes(lowerCaseFilterString) ||
      cocktailRecipe.glass?.name.toLowerCase().includes(lowerCaseFilterString) ||
      cocktailRecipe.garnishes.some((garnish) => garnish.garnish.name.toLowerCase().includes(lowerCaseFilterString)) ||
      cocktailRecipe.tags.some((tag) => tag.toLowerCase().includes(lowerCaseFilterString))
    );
  };
};
