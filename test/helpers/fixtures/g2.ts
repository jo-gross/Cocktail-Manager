/**
 * Fixtures for the cocktails / cocktail import-export / ratings / guest-info
 * integration tests (group g2).
 */
import { randomBytes } from 'node:crypto';
import prisma from '../../../prisma/prisma';

/** Smallest valid PNG (1×1, transparent) as a data URI. */
export const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Script-capable image type that must never be accepted. */
export const SVG_DATA_URI = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;

function suffix(): string {
  return randomBytes(3).toString('hex');
}

/** All dependencies a cocktail recipe can reference, in one workspace. */
export async function seedRecipeDeps(workspaceId: string, label = suffix()) {
  const glass = await prisma.glass.create({ data: { name: `Glass ${label}`, deposit: 1, workspaceId } });
  const ice = await prisma.ice.create({ data: { name: `Ice ${label}`, workspaceId } });
  const unit = await prisma.unit.create({ data: { name: `cl ${label}`, workspaceId } });
  const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: `Shake ${label}`, actionGroup: 'MIXING', workspaceId } });
  const ingredient = await prisma.ingredient.create({
    data: { name: `Rum ${label}`, workspaceId, IngredientVolume: { create: { volume: 70, unitId: unit.id, workspaceId } } },
  });
  const garnish = await prisma.garnish.create({ data: { name: `Lime ${label}`, workspaceId } });
  return { glass, ice, unit, action, ingredient, garnish };
}

export type RecipeDeps = Awaited<ReturnType<typeof seedRecipeDeps>>;

/** A cocktail with an image, two steps (one ingredient line each) and one garnish. */
export async function seedFullCocktail(workspaceId: string, deps: RecipeDeps, name = `Cocktail ${suffix()}`) {
  const cocktail = await prisma.cocktailRecipe.create({
    data: {
      name,
      workspaceId,
      glassId: deps.glass.id,
      iceId: deps.ice.id,
      tags: ['classic'],
      CocktailRecipeImage: { create: { image: PNG_DATA_URI } },
      garnishes: { create: { garnishId: deps.garnish.id, garnishNumber: 0, isAlternative: true } },
    },
  });
  for (const stepNumber of [0, 1]) {
    await prisma.cocktailRecipeStep.create({
      data: {
        cocktailRecipeId: cocktail.id,
        stepNumber,
        actionId: deps.action.id,
        ingredients: { create: { ingredientNumber: 0, amount: 4 + stepNumber, unitId: deps.unit.id, ingredientId: deps.ingredient.id } },
      },
    });
  }
  return loadCocktail(cocktail.id);
}

/** Cocktail with steps (ordered) + lines + garnishes + image, straight from the DB. */
export function loadCocktail(id: string) {
  return prisma.cocktailRecipe.findUniqueOrThrow({
    where: { id },
    include: {
      steps: { include: { ingredients: { orderBy: { ingredientNumber: 'asc' } } }, orderBy: { stepNumber: 'asc' } },
      garnishes: true,
      CocktailRecipeImage: true,
      ratings: true,
    },
  });
}

/** Comparable snapshot of a cocktail graph (to assert "unchanged"). */
export async function cocktailSnapshot(id: string) {
  const cocktail = await prisma.cocktailRecipe.findUnique({
    where: { id },
    include: {
      steps: { include: { ingredients: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } },
      garnishes: { orderBy: { garnishId: 'asc' } },
      CocktailRecipeImage: true,
      ratings: { orderBy: { id: 'asc' } },
    },
  });
  return JSON.parse(JSON.stringify(cocktail)) as unknown;
}

/** Create/update body for a cocktail using `deps` (one step with one line, one garnish). */
export function cocktailBody(deps: Pick<RecipeDeps, 'glass' | 'ice' | 'unit' | 'action' | 'ingredient' | 'garnish'>, overrides: Record<string, unknown> = {}) {
  return {
    name: `Body ${suffix()}`,
    glassId: deps.glass.id,
    iceId: deps.ice.id,
    tags: ['sour'],
    steps: [
      {
        stepNumber: 0,
        actionId: deps.action.id,
        ingredients: [{ ingredientNumber: 0, amount: 5, unitId: deps.unit.id, ingredientId: deps.ingredient.id }],
      },
    ],
    garnishes: [{ garnishId: deps.garnish.id, garnishNumber: 0 }],
    ...overrides,
  };
}

/** Row counts of the cocktail-related tables of a workspace (to assert "nothing written"). */
export async function workspaceContentCounts(workspaceId: string) {
  return {
    cocktails: await prisma.cocktailRecipe.count({ where: { workspaceId } }),
    steps: await prisma.cocktailRecipeStep.count({ where: { cocktailRecipe: { workspaceId } } }),
    lines: await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStep: { cocktailRecipe: { workspaceId } } } }),
    garnishLinks: await prisma.cocktailRecipeGarnish.count({ where: { cocktailRecipe: { workspaceId } } }),
    glasses: await prisma.glass.count({ where: { workspaceId } }),
    garnishes: await prisma.garnish.count({ where: { workspaceId } }),
    ingredients: await prisma.ingredient.count({ where: { workspaceId } }),
    units: await prisma.unit.count({ where: { workspaceId } }),
    ice: await prisma.ice.count({ where: { workspaceId } }),
    actions: await prisma.workspaceCocktailRecipeStepAction.count({ where: { workspaceId } }),
    auditLogs: await prisma.auditLog.count({ where: { workspaceId } }),
    settings: await prisma.workspaceSetting.count({ where: { workspaceId } }),
  };
}
