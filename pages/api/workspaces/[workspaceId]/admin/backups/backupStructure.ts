import {
  CocktailCalculation,
  CocktailCalculationItems,
  CocktailCard,
  CocktailCardGroup,
  CocktailCardGroupItem,
  CocktailRecipe,
  CocktailRecipeGarnish,
  CocktailRecipeImage,
  CocktailRecipeIngredient,
  CocktailRecipeStep,
  Garnish,
  GarnishImage,
  Glass,
  GlassImage,
  Ingredient,
  IngredientImage,
  WorkspaceCocktailRecipeStepAction,
  WorkspaceSetting,
} from '@prisma/client';

export interface BackupStructure {
  workspaceSettings: WorkspaceSetting[];
  stepActions: WorkspaceCocktailRecipeStepAction[];
  garnish: Garnish[];
  garnishImages: GarnishImage[];
  ingredient: Ingredient[];
  ingredientImages: IngredientImage[];
  glass: Glass[];
  glassImages: GlassImage[];
  cocktailRecipe: CocktailRecipe[];
  cocktailRecipeImage: CocktailRecipeImage[];
  cocktailRecipeStep: CocktailRecipeStep[];
  cocktailRecipeGarnish: CocktailRecipeGarnish[];
  cocktailRecipeIngredient: CocktailRecipeIngredient[];
  cocktailCard: CocktailCard[];
  cocktailCardGroup: CocktailCardGroup[];
  cocktailCardGroupItem: CocktailCardGroupItem[];
  calculation: CocktailCalculation[];
  calculationItems: CocktailCalculationItems[];
}
