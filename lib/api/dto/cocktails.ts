/**
 * Prisma → public DTO mapping for cocktails (cocktail recipes). Keeps the
 * /api/v1 contract clean:
 *  - `_count.CocktailRecipeImage` collapses to `hasImage` + `imageUrl`;
 *  - nested `glass`/`ice`/`garnish`/`ingredient`/`unit` become slim refs (their
 *    own `hasImage` derived from their `_count`);
 *  - the raw `ratings` array collapses to `averageRating` + `ratingCount`;
 *  - PascalCase relations disappear and `workspaceId` is dropped (implied by path).
 *
 * List vs. detail: `toCocktailSummaryDto` is the slim list/check shape;
 * `toCocktailDto` is the full recipe with steps, garnishes and rating aggregates.
 */
import type {
  CocktailRating,
  CocktailRecipe,
  CocktailRecipeGarnish,
  CocktailRecipeIngredient,
  CocktailRecipeStep,
  Garnish,
  Glass,
  Ice,
  Ingredient,
  Unit,
  WorkspaceCocktailRecipeStepAction,
} from '@generated/prisma/client';
import type { CocktailDto, CocktailGarnishNameRef, CocktailIngredientNameRef, CocktailSummaryDto } from '@lib/schemas/cocktails';

type GlassWithCount = Pick<Glass, 'id' | 'name' | 'deposit'> & { _count: { GlassImage: number } };

type GarnishWithCount = Pick<Garnish, 'id' | 'name' | 'price' | 'description' | 'notes'> & { _count: { GarnishImage: number } };
type IngredientWithCount = Pick<Ingredient, 'id' | 'name' | 'shortName' | 'description' | 'notes' | 'tags'> & { _count: { IngredientImage: number } };
type UnitRef = Pick<Unit, 'id' | 'name'>;
type ActionRef = Pick<WorkspaceCocktailRecipeStepAction, 'id' | 'name'>;

type IngredientLine = Pick<CocktailRecipeIngredient, 'id' | 'amount' | 'optional' | 'ingredientNumber'> & {
  unit: UnitRef | null;
  ingredient: IngredientWithCount | null;
};

type StepWithIngredients = Pick<CocktailRecipeStep, 'id' | 'stepNumber' | 'optional'> & {
  action: ActionRef | null;
  ingredients: IngredientLine[];
};

type GarnishWithGarnish = Pick<CocktailRecipeGarnish, 'garnishId' | 'garnishNumber' | 'description' | 'optional' | 'isAlternative'> & {
  garnish: GarnishWithCount;
};

/** Minimal shape needed for the slim summary (list view). */
type CocktailSummaryShape = Pick<CocktailRecipe, 'id' | 'name' | 'description' | 'tags' | 'price' | 'isArchived'> & {
  _count?: { CocktailRecipeImage: number };
  glass?: GlassWithCount | null;
};

/** Full shape needed for the detail view. */
type CocktailFullShape = CocktailSummaryShape & {
  description: string | null;
  notes: string | null;
  history: string | null;
  ice?: Pick<Ice, 'id' | 'name'> | null;
  garnishes: GarnishWithGarnish[];
  steps: StepWithIngredients[];
  ratings: Pick<CocktailRating, 'rating'>[];
};

function imageFields(hasImage: boolean, workspaceId: string, cocktailId: string): { hasImage: boolean; imageUrl: string | null } {
  return {
    hasImage,
    imageUrl: hasImage ? `/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}/image` : null,
  };
}

/**
 * Slim summary for list views (and the `check` endpoint) — no nested steps/garnishes/ratings.
 * The optional `include` projections (garnish/ingredient name refs) are computed by the caller
 * (`listCocktails`) only when requested via `?include=`, so this stays cheap for the common case.
 */
export function toCocktailSummaryDto(
  cocktail: CocktailSummaryShape,
  workspaceId: string,
  include?: { garnishes?: CocktailGarnishNameRef[]; ingredients?: CocktailIngredientNameRef[] },
): CocktailSummaryDto {
  const hasImage = (cocktail._count?.CocktailRecipeImage ?? 0) > 0;
  return {
    id: cocktail.id,
    name: cocktail.name,
    description: cocktail.description,
    tags: cocktail.tags,
    price: cocktail.price,
    isArchived: cocktail.isArchived,
    ...imageFields(hasImage, workspaceId, cocktail.id),
    glass: cocktail.glass
      ? { id: cocktail.glass.id, name: cocktail.glass.name, deposit: cocktail.glass.deposit, hasImage: cocktail.glass._count.GlassImage > 0 }
      : null,
    ...(include?.garnishes ? { garnishes: include.garnishes } : {}),
    ...(include?.ingredients ? { ingredients: include.ingredients } : {}),
  };
}

/** Full cocktail with nested steps, ingredients, garnishes and rating aggregates. */
export function toCocktailDto(cocktail: CocktailFullShape, workspaceId: string): CocktailDto {
  const ratingCount = cocktail.ratings.length;
  const averageRating = ratingCount > 0 ? cocktail.ratings.reduce((sum, r) => sum + r.rating, 0) / ratingCount : null;

  return {
    ...toCocktailSummaryDto(cocktail, workspaceId),
    description: cocktail.description,
    notes: cocktail.notes,
    history: cocktail.history,
    ice: cocktail.ice ? { id: cocktail.ice.id, name: cocktail.ice.name } : null,
    garnishes: cocktail.garnishes.map((garnish) => ({
      garnishId: garnish.garnishId,
      garnishNumber: garnish.garnishNumber,
      description: garnish.description,
      optional: garnish.optional ?? false,
      isAlternative: garnish.isAlternative ?? false,
      garnish: {
        id: garnish.garnish.id,
        name: garnish.garnish.name,
        price: garnish.garnish.price,
        description: garnish.garnish.description,
        notes: garnish.garnish.notes,
        hasImage: garnish.garnish._count.GarnishImage > 0,
      },
    })),
    steps: cocktail.steps.map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      optional: step.optional,
      action: step.action ? { id: step.action.id, name: step.action.name } : null,
      ingredients: step.ingredients.map((line) => ({
        id: line.id,
        amount: line.amount,
        optional: line.optional,
        ingredientNumber: line.ingredientNumber,
        unit: line.unit ? { id: line.unit.id, name: line.unit.name } : null,
        ingredient: line.ingredient
          ? {
              id: line.ingredient.id,
              name: line.ingredient.name,
              shortName: line.ingredient.shortName,
              description: line.ingredient.description,
              notes: line.ingredient.notes,
              tags: line.ingredient.tags,
              hasImage: line.ingredient._count.IngredientImage > 0,
            }
          : null,
      })),
    })),
    averageRating,
    ratingCount,
  };
}
