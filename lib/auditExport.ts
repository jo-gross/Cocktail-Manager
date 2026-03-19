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
    groupId?: string | null;
    groupName?: string | null;
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

// ────────────── HELPER ──────────────

function rec(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function str(value: unknown): string {
  return (value ?? '') as string;
}

function strNull(value: unknown): string | null {
  return (value ?? null) as string | null;
}

function numNull(value: unknown): number | null {
  return (value ?? null) as number | null;
}

// ────────────── CONVERSION FUNCTIONS ──────────────

/**
 * Converts raw Prisma cocktail data (stored as exportData) into a CocktailExportStructure
 * compatible with the existing import-json endpoint.
 */
export function buildCocktailExport(rawData: Record<string, unknown>, version: string): CocktailExportStructure {
  if (!rawData) {
    return emptyExport(version);
  }

  const recipe = rawData;
  const cocktailRecipe: CocktailExportStructure['cocktailRecipes'][number] = {
    id: str(recipe.id),
    name: str(recipe.name),
    description: strNull(recipe.description),
    notes: strNull(recipe.notes),
    history: strNull(recipe.history),
    tags: (recipe.tags ?? []) as string[],
    price: numNull(recipe.price),
    iceId: strNull(recipe.iceId),
    glassId: strNull(recipe.glassId),
    isArchived: (recipe.isArchived ?? false) as boolean,
    workspaceId: str(recipe.workspaceId),
  };

  type StepEntry = CocktailExportStructure['cocktailRecipeSteps'][number];
  type IngredientEntry = CocktailExportStructure['cocktailRecipeIngredients'][number];
  type GarnishEntry = CocktailExportStructure['cocktailRecipeGarnishes'][number];
  type GlassEntry = CocktailExportStructure['glasses'][number];
  type IceEntry = CocktailExportStructure['ice'][number];
  type UnitEntry = CocktailExportStructure['units'][number];
  type StepActionEntry = CocktailExportStructure['stepActions'][number];
  type IngEntry = CocktailExportStructure['ingredients'][number];
  type GarnEntry = CocktailExportStructure['garnishes'][number];

  const cocktailRecipeSteps: StepEntry[] = [];
  const cocktailRecipeIngredients: IngredientEntry[] = [];
  const unitsMap = new Map<string, UnitEntry>();
  const ingredientsMap = new Map<string, IngEntry>();
  const stepActionsMap = new Map<string, StepActionEntry>();

  if (recipe.steps && Array.isArray(recipe.steps)) {
    for (const rawStep of recipe.steps) {
      const step = rec(rawStep);
      cocktailRecipeSteps.push({
        id: str(step.id),
        stepNumber: (step.stepNumber ?? 0) as number,
        optional: (step.optional ?? false) as boolean,
        actionId: str(step.actionId),
        cocktailRecipeId: str(recipe.id),
      });

      if (step.action) {
        const action = rec(step.action);
        const actionId = str(action.id || step.actionId);
        stepActionsMap.set(actionId, {
          id: actionId,
          name: str(action.name),
          actionGroup: str(action.actionGroup),
          workspaceId: str(action.workspaceId || recipe.workspaceId),
        });
      }

      if (step.ingredients && Array.isArray(step.ingredients)) {
        for (const rawIng of step.ingredients) {
          const ing = rec(rawIng);
          cocktailRecipeIngredients.push({
            id: str(ing.id),
            ingredientNumber: (ing.ingredientNumber ?? 0) as number,
            optional: (ing.optional ?? false) as boolean,
            amount: numNull(ing.amount),
            unitId: strNull(ing.unitId),
            ingredientId: strNull(ing.ingredientId),
            cocktailRecipeStepId: str(step.id),
          });

          if (ing.unit) {
            const unit = rec(ing.unit);
            const unitId = str(unit.id || ing.unitId);
            unitsMap.set(unitId, {
              id: unitId,
              name: str(unit.name),
              workspaceId: str(unit.workspaceId || recipe.workspaceId),
            });
          }

          if (ing.ingredient) {
            const ingredient = rec(ing.ingredient);
            const ingredientId = str(ingredient.id || ing.ingredientId);
            ingredientsMap.set(ingredientId, {
              id: ingredientId,
              name: str(ingredient.name),
              shortName: strNull(ingredient.shortName),
              description: strNull(ingredient.description),
              notes: strNull(ingredient.notes),
              price: numNull(ingredient.price),
              link: strNull(ingredient.link),
              tags: (ingredient.tags ?? []) as string[],
              workspaceId: str(ingredient.workspaceId || recipe.workspaceId),
            });
          }
        }
      }
    }
  }

  const cocktailRecipeGarnishes: GarnishEntry[] = [];
  const garnishesMap = new Map<string, GarnEntry>();

  if (recipe.garnishes && Array.isArray(recipe.garnishes)) {
    for (const rawG of recipe.garnishes) {
      const g = rec(rawG);
      cocktailRecipeGarnishes.push({
        cocktailRecipeId: str(recipe.id),
        garnishId: str(g.garnishId),
        description: strNull(g.description),
        garnishNumber: (g.garnishNumber ?? 0) as number,
        optional: (g.optional ?? false) as boolean,
        isAlternative: (g.isAlternative ?? false) as boolean | null,
      });

      if (g.garnish) {
        const garnish = rec(g.garnish);
        const garnishId = str(garnish.id || g.garnishId);
        garnishesMap.set(garnishId, {
          id: garnishId,
          name: str(garnish.name),
          description: strNull(garnish.description),
          notes: strNull(garnish.notes),
          price: numNull(garnish.price),
          workspaceId: str(garnish.workspaceId || recipe.workspaceId),
        });
      }
    }
  }

  const glasses: GlassEntry[] = [];
  if (recipe.glass) {
    const glass = rec(recipe.glass);
    glasses.push({
      id: str(glass.id || recipe.glassId),
      name: str(glass.name),
      notes: strNull(glass.notes),
      volume: numNull(glass.volume),
      deposit: (glass.deposit ?? 0) as number,
      workspaceId: str(glass.workspaceId || recipe.workspaceId),
    });
  }

  const ice: IceEntry[] = [];
  if (recipe.ice) {
    const iceData = rec(recipe.ice);
    ice.push({
      id: str(iceData.id || recipe.iceId),
      name: str(iceData.name),
      workspaceId: str(iceData.workspaceId || recipe.workspaceId),
    });
  }

  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    exportedFrom: {
      workspaceId: str(recipe.workspaceId),
      workspaceName: '',
    },
    cocktailRecipes: [cocktailRecipe],
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
export function buildGlassExport(rawData: Record<string, unknown>, version: string): GlassExportStructure {
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    glass: {
      id: str(rawData.id),
      name: str(rawData.name),
      notes: strNull(rawData.notes),
      volume: numNull(rawData.volume),
      deposit: numNull(rawData.deposit),
      workspaceId: str(rawData.workspaceId),
    },
  };
}

/**
 * Converts raw Garnish entity data to an importable export structure.
 */
export function buildGarnishExport(rawData: Record<string, unknown>, version: string): GarnishExportStructure {
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    garnish: {
      id: str(rawData.id),
      name: str(rawData.name),
      description: strNull(rawData.description),
      notes: strNull(rawData.notes),
      price: numNull(rawData.price),
      workspaceId: str(rawData.workspaceId),
    },
  };
}

/**
 * Converts raw Ingredient entity data to an importable export structure.
 */
export function buildIngredientExport(rawData: Record<string, unknown>, version: string): IngredientExportStructure {
  const ingredientVolumes: IngredientExportStructure['ingredientVolumes'] = [];
  const unitsMap = new Map<string, { id: string; name: string; workspaceId: string }>();

  const volumes = rawData.IngredientVolume || rawData.units;
  if (volumes && Array.isArray(volumes)) {
    for (const rawV of volumes) {
      const v = rec(rawV);
      ingredientVolumes.push({
        id: str(v.id),
        volume: (v.volume ?? 0) as number,
        ingredientId: str(rawData.id),
        unitId: str(v.unitId),
        workspaceId: str(v.workspaceId || rawData.workspaceId),
      });
      if (v.unit) {
        const unit = rec(v.unit);
        const unitId = str(unit.id || v.unitId);
        unitsMap.set(unitId, {
          id: unitId,
          name: str(unit.name),
          workspaceId: str(unit.workspaceId || rawData.workspaceId),
        });
      }
    }
  }

  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    ingredient: {
      id: str(rawData.id),
      name: str(rawData.name),
      shortName: strNull(rawData.shortName),
      description: strNull(rawData.description),
      notes: strNull(rawData.notes),
      price: numNull(rawData.price),
      link: strNull(rawData.link),
      tags: (rawData.tags ?? []) as string[],
      workspaceId: str(rawData.workspaceId),
    },
    ingredientVolumes,
    units: Array.from(unitsMap.values()),
  };
}

/**
 * Converts raw CocktailCalculation entity data to an importable export structure.
 */
export function buildCalculationExport(rawData: Record<string, unknown>, version: string): CocktailCalculationExportStructure {
  const cocktailCalculationItems: CocktailCalculationExportStructure['cocktailCalculationItems'] = [];
  const ingredientShoppingUnits: CocktailCalculationExportStructure['ingredientShoppingUnits'] = [];

  if (rawData.cocktailCalculationItems && Array.isArray(rawData.cocktailCalculationItems)) {
    for (const rawItem of rawData.cocktailCalculationItems) {
      const item = rec(rawItem);
      const cocktail = rec(item.cocktail);
      cocktailCalculationItems.push({
        calculationId: str(rawData.id),
        cocktailId: str(item.cocktailId),
        cocktailName: str(cocktail.name || item.cocktailId),
        plannedAmount: (item.plannedAmount ?? 0) as number,
        customPrice: numNull(item.customPrice),
      });
    }
  }

  if (rawData.ingredientShoppingUnits && Array.isArray(rawData.ingredientShoppingUnits)) {
    for (const rawSu of rawData.ingredientShoppingUnits) {
      const su = rec(rawSu);
      const ingredient = rec(su.ingredient);
      const unit = rec(su.unit);
      ingredientShoppingUnits.push({
        ingredientId: str(su.ingredientId),
        ingredientName: str(ingredient.name || su.ingredientId),
        unitId: str(su.unitId),
        unitName: str(unit.name || su.unitId),
        checked: (su.checked ?? false) as boolean,
        cocktailCalculationId: str(rawData.id),
      });
    }
  }

  const group = rec(rawData.group);
  return {
    exportVersion: version,
    exportDate: new Date().toISOString(),
    calculation: {
      id: str(rawData.id),
      name: str(rawData.name),
      showSalesStuff: (rawData.showSalesStuff ?? false) as boolean,
      workspaceId: str(rawData.workspaceId),
      updatedByUserId: str(rawData.updatedByUserId),
      groupId: strNull(rawData.groupId),
      groupName: strNull(group.name),
    },
    cocktailCalculationItems,
    ingredientShoppingUnits,
  };
}

/**
 * Dispatches to the correct export builder based on entity type.
 */
export function buildExportData(
  entityType: string,
  rawData: Record<string, unknown> | null,
  version: string,
):
  | CocktailExportStructure
  | GlassExportStructure
  | GarnishExportStructure
  | IngredientExportStructure
  | CocktailCalculationExportStructure
  | Record<string, unknown>
  | null {
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
