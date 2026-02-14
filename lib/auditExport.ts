import { CocktailExportStructure } from '../types/CocktailExportStructure';

// ────────────── EXPORT STRUCTURE INTERFACES ──────────────

export interface GlassExportStructure {
  exportVersion: string;
  exportDate: string;
  glass: {
    id: string;
    name: string;
    notes?: string | null;
    volume?: number | null;
    deposit?: number | null;
    workspaceId: string;
  };
}

export interface GarnishExportStructure {
  exportVersion: string;
  exportDate: string;
  garnish: {
    id: string;
    name: string;
    description?: string | null;
    notes?: string | null;
    price?: number | null;
    workspaceId: string;
  };
}

export interface IngredientExportStructure {
  exportVersion: string;
  exportDate: string;
  ingredient: {
    id: string;
    name: string;
    shortName?: string | null;
    description?: string | null;
    notes?: string | null;
    price?: number | null;
    link?: string | null;
    tags?: string[];
    workspaceId: string;
  };
  ingredientVolumes: Array<{
    id: string;
    volume: number;
    ingredientId: string;
    unitId: string;
    workspaceId: string;
  }>;
  units: Array<{
    id: string;
    name: string;
    workspaceId: string;
  }>;
}

export interface CocktailCalculationExportStructure {
  exportVersion: string;
  exportDate: string;
  calculation: {
    id: string;
    name: string;
    showSalesStuff?: boolean;
    workspaceId: string;
    updatedByUserId: string;
  };
  cocktailCalculationItems: Array<{
    calculationId: string;
    cocktailId: string;
    cocktailName: string;
    plannedAmount: number;
    customPrice?: number | null;
  }>;
  ingredientShoppingUnits: Array<{
    ingredientId: string;
    ingredientName: string;
    unitId: string;
    unitName: string;
    checked: boolean;
    cocktailCalculationId: string;
  }>;
}

// ────────────── CONVERSION FUNCTIONS ──────────────

/**
 * Converts raw Prisma cocktail data (stored as exportData) into a CocktailExportStructure
 * compatible with the existing import-json endpoint.
 */
export function buildCocktailExport(rawData: any, version: string): CocktailExportStructure {
  if (!rawData) {
    return emptyExport(version);
  }

  const recipe = rawData;
  const cocktailRecipe = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description ?? null,
    notes: recipe.notes ?? null,
    history: recipe.history ?? null,
    tags: recipe.tags ?? [],
    price: recipe.price ?? null,
    iceId: recipe.iceId ?? null,
    glassId: recipe.glassId ?? null,
    isArchived: recipe.isArchived ?? false,
    workspaceId: recipe.workspaceId,
  };

  // Extract steps
  const cocktailRecipeSteps: any[] = [];
  const cocktailRecipeIngredients: any[] = [];
  const unitsMap = new Map<string, any>();
  const ingredientsMap = new Map<string, any>();
  const stepActionsMap = new Map<string, any>();

  if (recipe.steps && Array.isArray(recipe.steps)) {
    for (const step of recipe.steps) {
      cocktailRecipeSteps.push({
        id: step.id,
        stepNumber: step.stepNumber,
        optional: step.optional ?? false,
        actionId: step.actionId,
        cocktailRecipeId: recipe.id,
      });

      if (step.action) {
        stepActionsMap.set(step.action.id || step.actionId, {
          id: step.action.id || step.actionId,
          name: step.action.name,
          actionGroup: step.action.actionGroup,
          workspaceId: step.action.workspaceId || recipe.workspaceId,
        });
      }

      if (step.ingredients && Array.isArray(step.ingredients)) {
        for (const ing of step.ingredients) {
          cocktailRecipeIngredients.push({
            id: ing.id,
            ingredientNumber: ing.ingredientNumber,
            optional: ing.optional ?? false,
            amount: ing.amount ?? null,
            unitId: ing.unitId ?? null,
            ingredientId: ing.ingredientId ?? null,
            cocktailRecipeStepId: step.id,
          });

          if (ing.unit) {
            unitsMap.set(ing.unit.id || ing.unitId, {
              id: ing.unit.id || ing.unitId,
              name: ing.unit.name,
              workspaceId: ing.unit.workspaceId || recipe.workspaceId,
            });
          }

          if (ing.ingredient) {
            ingredientsMap.set(ing.ingredient.id || ing.ingredientId, {
              id: ing.ingredient.id || ing.ingredientId,
              name: ing.ingredient.name,
              shortName: ing.ingredient.shortName ?? null,
              description: ing.ingredient.description ?? null,
              notes: ing.ingredient.notes ?? null,
              price: ing.ingredient.price ?? null,
              link: ing.ingredient.link ?? null,
              tags: ing.ingredient.tags ?? [],
              workspaceId: ing.ingredient.workspaceId || recipe.workspaceId,
            });
          }
        }
      }
    }
  }

  // Extract garnishes
  const cocktailRecipeGarnishes: any[] = [];
  const garnishesMap = new Map<string, any>();

  if (recipe.garnishes && Array.isArray(recipe.garnishes)) {
    for (const g of recipe.garnishes) {
      cocktailRecipeGarnishes.push({
        cocktailRecipeId: recipe.id,
        garnishId: g.garnishId,
        description: g.description ?? null,
        garnishNumber: g.garnishNumber,
        optional: g.optional ?? false,
        isAlternative: g.isAlternative ?? false,
      });

      if (g.garnish) {
        garnishesMap.set(g.garnish.id || g.garnishId, {
          id: g.garnish.id || g.garnishId,
          name: g.garnish.name,
          description: g.garnish.description ?? null,
          notes: g.garnish.notes ?? null,
          price: g.garnish.price ?? null,
          workspaceId: g.garnish.workspaceId || recipe.workspaceId,
        });
      }
    }
  }

  // Glass
  const glasses: any[] = [];
  if (recipe.glass) {
    glasses.push({
      id: recipe.glass.id || recipe.glassId,
      name: recipe.glass.name,
      notes: recipe.glass.notes ?? null,
      volume: recipe.glass.volume ?? null,
      deposit: recipe.glass.deposit ?? 0,
      workspaceId: recipe.glass.workspaceId || recipe.workspaceId,
    });
  }

  // Ice
  const ice: any[] = [];
  if (recipe.ice) {
    ice.push({
      id: recipe.ice.id || recipe.iceId,
      name: recipe.ice.name,
      workspaceId: recipe.ice.workspaceId || recipe.workspaceId,
    });
  }

  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    exportedFrom: {
      workspaceId: recipe.workspaceId,
      workspaceName: '',
    },
    cocktailRecipes: [cocktailRecipe as any],
    cocktailRecipeImages: [],
    cocktailRecipeSteps,
    cocktailRecipeGarnishes,
    cocktailRecipeIngredients,
    glasses,
    glassImages: [],
    garnishes: Array.from(garnishesMap.values()),
    garnishImages: [],
    ingredients: Array.from(ingredientsMap.values()),
    ingredientImages: [],
    ingredientVolumes: [],
    ice,
    units: Array.from(unitsMap.values()),
    stepActions: Array.from(stepActionsMap.values()),
  };
}

/**
 * Converts raw Glass entity data to an importable export structure.
 */
export function buildGlassExport(rawData: any, version: string): GlassExportStructure {
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    glass: {
      id: rawData.id,
      name: rawData.name,
      notes: rawData.notes ?? null,
      volume: rawData.volume ?? null,
      deposit: rawData.deposit ?? null,
      workspaceId: rawData.workspaceId,
    },
  };
}

/**
 * Converts raw Garnish entity data to an importable export structure.
 */
export function buildGarnishExport(rawData: any, version: string): GarnishExportStructure {
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    garnish: {
      id: rawData.id,
      name: rawData.name,
      description: rawData.description ?? null,
      notes: rawData.notes ?? null,
      price: rawData.price ?? null,
      workspaceId: rawData.workspaceId,
    },
  };
}

/**
 * Converts raw Ingredient entity data to an importable export structure.
 */
export function buildIngredientExport(rawData: any, version: string): IngredientExportStructure {
  const ingredientVolumes: IngredientExportStructure['ingredientVolumes'] = [];
  const unitsMap = new Map<string, any>();

  const volumes = rawData.IngredientVolume || rawData.units;
  if (volumes && Array.isArray(volumes)) {
    for (const v of volumes) {
      ingredientVolumes.push({
        id: v.id,
        volume: v.volume,
        ingredientId: rawData.id,
        unitId: v.unitId,
        workspaceId: v.workspaceId || rawData.workspaceId,
      });
      if (v.unit) {
        unitsMap.set(v.unit.id || v.unitId, {
          id: v.unit.id || v.unitId,
          name: v.unit.name,
          workspaceId: v.unit.workspaceId || rawData.workspaceId,
        });
      }
    }
  }

  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    ingredient: {
      id: rawData.id,
      name: rawData.name,
      shortName: rawData.shortName ?? null,
      description: rawData.description ?? null,
      notes: rawData.notes ?? null,
      price: rawData.price ?? null,
      link: rawData.link ?? null,
      tags: rawData.tags ?? [],
      workspaceId: rawData.workspaceId,
    },
    ingredientVolumes,
    units: Array.from(unitsMap.values()),
  };
}

/**
 * Converts raw CocktailCalculation entity data to an importable export structure.
 */
export function buildCalculationExport(rawData: any, version: string): CocktailCalculationExportStructure {
  const cocktailCalculationItems: CocktailCalculationExportStructure['cocktailCalculationItems'] = [];
  const ingredientShoppingUnits: CocktailCalculationExportStructure['ingredientShoppingUnits'] = [];

  if (rawData.cocktailCalculationItems && Array.isArray(rawData.cocktailCalculationItems)) {
    for (const item of rawData.cocktailCalculationItems) {
      cocktailCalculationItems.push({
        calculationId: rawData.id,
        cocktailId: item.cocktailId,
        cocktailName: item.cocktail?.name || item.cocktailId,
        plannedAmount: item.plannedAmount,
        customPrice: item.customPrice ?? null,
      });
    }
  }

  if (rawData.ingredientShoppingUnits && Array.isArray(rawData.ingredientShoppingUnits)) {
    for (const su of rawData.ingredientShoppingUnits) {
      ingredientShoppingUnits.push({
        ingredientId: su.ingredientId,
        ingredientName: su.ingredient?.name || su.ingredientId,
        unitId: su.unitId,
        unitName: su.unit?.name || su.unitId,
        checked: su.checked ?? false,
        cocktailCalculationId: rawData.id,
      });
    }
  }

  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    calculation: {
      id: rawData.id,
      name: rawData.name,
      showSalesStuff: rawData.showSalesStuff ?? false,
      workspaceId: rawData.workspaceId,
      updatedByUserId: rawData.updatedByUserId,
    },
    cocktailCalculationItems,
    ingredientShoppingUnits,
  };
}

/**
 * Dispatches to the correct export builder based on entity type.
 */
export function buildExportData(entityType: string, rawData: any, version: string): any {
  if (!rawData) return null;
  switch (entityType) {
    case 'CocktailRecipe':
      return buildCocktailExport(rawData, version);
    case 'Glass':
      return buildGlassExport(rawData, version);
    case 'Garnish':
      return buildGarnishExport(rawData, version);
    case 'Ingredient':
      return buildIngredientExport(rawData, version);
    case 'CocktailCalculation':
      return buildCalculationExport(rawData, version);
    default:
      return rawData;
  }
}

function emptyExport(version: string): CocktailExportStructure {
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    exportedFrom: { workspaceId: '', workspaceName: '' },
    cocktailRecipes: [],
    cocktailRecipeImages: [],
    cocktailRecipeSteps: [],
    cocktailRecipeGarnishes: [],
    cocktailRecipeIngredients: [],
    glasses: [],
    glassImages: [],
    garnishes: [],
    garnishImages: [],
    ingredients: [],
    ingredientImages: [],
    ingredientVolumes: [],
    ice: [],
    units: [],
    stepActions: [],
  };
}
