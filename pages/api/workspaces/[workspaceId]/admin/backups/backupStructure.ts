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
  IngredientVolume,
  Unit,
  UnitConversion,
  WorkspaceCocktailRecipeStepAction,
  WorkspaceSetting,
} from '@prisma/client';

export interface BackupStructure {
  units: Unit[];
  unitConversions: UnitConversion[];
  workspaceSettings: WorkspaceSetting[];
  stepActions: WorkspaceCocktailRecipeStepAction[];
  garnish: Garnish[];
  garnishImages: GarnishImage[];
  ingredient: Ingredient[];
  ingredientVolumes: IngredientVolume[];
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
