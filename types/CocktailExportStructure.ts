import {
  CocktailRecipe,
  CocktailRecipeGarnish,
  CocktailRecipeImage,
  CocktailRecipeIngredient,
  CocktailRecipeStep,
  Garnish,
  GarnishImage,
  Glass,
  GlassImage,
  Ice,
  Ingredient,
  IngredientImage,
  IngredientVolume,
  Unit,
  WorkspaceCocktailRecipeStepAction,
} from '@generated/prisma/client';

export interface CocktailExportStructure {
  exportVersion: string;
  exportDate: string;
  exportedFrom: {
    workspaceId: string;
    workspaceName: string;
  };

  // Cocktail data
  cocktailRecipes: CocktailRecipe[];
  cocktailRecipeImages: CocktailRecipeImage[];
  cocktailRecipeSteps: CocktailRecipeStep[];
  cocktailRecipeGarnishes: CocktailRecipeGarnish[];
  cocktailRecipeIngredients: CocktailRecipeIngredient[];

  // Dependencies (only referenced ones)
  glasses: Glass[];
  glassImages: GlassImage[];
  garnishes: Garnish[];
  garnishImages: GarnishImage[];
  ingredients: Ingredient[];
  ingredientImages: IngredientImage[];
  ingredientVolumes: IngredientVolume[];
  ice: Ice[];
  units: Unit[];
  stepActions: WorkspaceCocktailRecipeStepAction[];
}
