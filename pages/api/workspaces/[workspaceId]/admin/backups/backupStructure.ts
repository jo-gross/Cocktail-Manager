import {
  CocktailCalculation,
  CocktailCalculationGroup,
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
  Ice,
  Ingredient,
  IngredientImage,
  IngredientVolume,
  MonitorFormat,
  SignageBackgroundMode,
  Unit,
  UnitConversion,
  WorkspaceCocktailRecipeStepAction,
  WorkspaceSetting,
} from '@generated/prisma/client';

/** Signage container in backups; `content` is legacy pre-slide schema. */
export interface SignageBackupRecord {
  workspaceId?: string;
  format: MonitorFormat;
  backgroundColor?: string | null;
  backgroundMode?: SignageBackgroundMode;
  slideDurationSeconds?: number;
  mirrorSourceFormat?: MonitorFormat | null;
  content?: string;
}

/** Slide in backups; scheduling and mirror fields are optional for older exports. */
export interface SignageSlideBackupRecord {
  id?: string;
  workspaceId?: string;
  format: MonitorFormat;
  content: string;
  order: number;
  enabled?: boolean;
  weekdays?: number[];
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  dateExclusive?: boolean;
}

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
  calculationGroups: CocktailCalculationGroup[];
  calculationItems: CocktailCalculationItems[];
  ice: Ice[];
  signage?: SignageBackupRecord[];
  signageSlides?: SignageSlideBackupRecord[];
}
