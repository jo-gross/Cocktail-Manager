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
  Prisma,
  SignageBackgroundMode,
  SignageSlideType,
  Unit,
  UnitConversion,
  WorkspaceCocktailRecipeStepAction,
  WorkspaceSetting,
  TagCategory,
  TagDefinition,
  CocktailRecipeTranslation,
  IngredientTranslation,
  GarnishTranslation,
  GlassTranslation,
  GuestMenuTemplate,
} from '@generated/prisma/client';
import type { GuestMenuBackupRecord } from '@lib/backup/backupSecurity';

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
  /** Missing in older exports = IMAGE. */
  type?: SignageSlideType;
  /** GUEST_MENU slides: id of the menu in the backup (remapped on import), null = active menu. */
  guestMenuId?: string | null;
  options?: Prisma.JsonValue | null;
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
  /** Tag metadata and content translations (optional for older exports). */
  tagCategories?: TagCategory[];
  tagDefinitions?: TagDefinition[];
  cocktailRecipeTranslations?: CocktailRecipeTranslation[];
  ingredientTranslations?: IngredientTranslation[];
  garnishTranslations?: GarnishTranslation[];
  glassTranslations?: GlassTranslation[];
  /**
   * Guest menus (documents reference cocktails/ingredients/card groups/templates by id) – optional for older exports.
   * Without access code and preview token; imported menus are always created disabled and unpublished.
   */
  guestMenus?: GuestMenuBackupRecord[];
  guestMenuTemplates?: GuestMenuTemplate[];
}
