import { CocktailRecipeModel } from '../models/CocktailRecipeModel';

export const cocktailFilter = (cocktail: CocktailRecipeModel, filterString: string) => {
  return (
    cocktail.name.toLowerCase().includes(filterString.toLowerCase()) || cocktail.tags.some((tag) => tag.toLowerCase().includes(filterString.toLowerCase()))
  );
};
