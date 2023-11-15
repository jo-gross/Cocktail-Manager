import {
  CocktailCalculation,
  CocktailCalculationItems,
  CocktailCard,
  CocktailCardGroup,
  CocktailCardGroupItem,
  CocktailRecipe,
  CocktailRecipeGarnish,
  CocktailRecipeIngredient,
  CocktailRecipeStep,
  Garnish,
  Glass,
  Ingredient,
} from '@prisma/client';

export interface BackupStructure {
  garnish: Garnish[];
  ingredient: Ingredient[];
  glass: Glass[];
  cocktailRecipe: CocktailRecipe[];
  cocktailRecipeStep: CocktailRecipeStep[];
  cocktailRecipeGarnish: CocktailRecipeGarnish[];
  cocktailRecipeIngredient: CocktailRecipeIngredient[];
  cocktailCard: CocktailCard[];
  cocktailCardGroup: CocktailCardGroup[];
  cocktailCardGroupItem: CocktailCardGroupItem[];
  calculation: CocktailCalculation[];
  calculationItems: CocktailCalculationItems[];
}
