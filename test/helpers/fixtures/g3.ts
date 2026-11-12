/**
 * Fixtures for the calculations / cards / queue / statistics integration tests.
 */
import { randomBytes } from 'node:crypto';
import prisma from '../../../prisma/prisma';
import { seedCocktail, seedGlass, seedIngredient } from '../dbFixtures';

function suffix(): string {
  return randomBytes(3).toString('hex');
}

export async function seedUnit(workspaceId: string, name = `Unit ${suffix()}`) {
  return prisma.unit.create({ data: { name, workspaceId } });
}

/** One cocktail, ingredient and unit of a workspace — the ids calculations/cards reference. */
export async function seedContent(workspaceId: string) {
  const glass = await seedGlass(workspaceId);
  const cocktail = await seedCocktail(workspaceId, glass.id);
  const ingredient = await seedIngredient(workspaceId);
  const unit = await seedUnit(workspaceId);
  return { glass, cocktail, ingredient, unit };
}

export async function seedCalculationGroup(workspaceId: string, name = `Group ${suffix()}`) {
  return prisma.cocktailCalculationGroup.create({ data: { name, workspaceId } });
}

export async function seedCalculation(
  workspaceId: string,
  userId: string,
  content: { cocktailId: string; ingredientId: string; unitId: string },
  overrides: { name?: string; groupId?: string } = {},
) {
  return prisma.cocktailCalculation.create({
    data: {
      name: overrides.name ?? `Calculation ${suffix()}`,
      workspaceId,
      updatedByUserId: userId,
      groupId: overrides.groupId,
      cocktailCalculationItems: { create: { cocktailId: content.cocktailId, plannedAmount: 10, customPrice: 9.5 } },
      ingredientShoppingUnits: { create: { ingredientId: content.ingredientId, unitId: content.unitId, checked: true } },
    },
  });
}

export async function seedCard(workspaceId: string, cocktailId: string, name = `Card ${suffix()}`) {
  return prisma.cocktailCard.create({
    data: {
      name,
      workspaceId,
      groups: { create: { name: 'Group 1', groupNumber: 0, items: { create: { cocktailId, itemNumber: 0, specialPrice: 7 } } } },
    },
    include: { groups: { include: { items: true } } },
  });
}

export async function seedQueueItems(workspaceId: string, cocktailId: string, count: number, notes: string | null = null) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(await prisma.cocktailQueue.create({ data: { workspaceId, cocktailId, notes } }));
  }
  return rows;
}

export async function seedStatistic(workspaceId: string, cocktailId: string, date = new Date()) {
  return prisma.cocktailStatisticItem.create({ data: { workspaceId, cocktailId, date } });
}

export async function seedSavedSet(workspaceId: string, items: string[], type: 'COCKTAIL_SET' | 'TAG_SET' | 'INGREDIENT_SET' = 'COCKTAIL_SET') {
  return prisma.statisticSavedSet.create({ data: { workspaceId, name: `Set ${suffix()}`, type, logic: 'AND', items } });
}

/** Export item in the round-trip shape of POST /calculations/export/json. */
export function calculationExportItem(
  name: string,
  refs: { cocktailName: string; ingredientName: string; unitName: string },
  overrides: { groupName?: string | null; plannedAmount?: unknown } = {},
) {
  return {
    exportVersion: '1.0.0',
    exportDate: new Date().toISOString(),
    calculation: {
      id: 'exported-id',
      name,
      showSalesStuff: true,
      workspaceId: 'other-ws',
      updatedByUserId: 'other-user',
      groupId: null,
      groupName: overrides.groupName ?? null,
    },
    cocktailCalculationItems: [
      {
        calculationId: 'exported-id',
        cocktailId: 'other-cocktail',
        cocktailName: refs.cocktailName,
        plannedAmount: overrides.plannedAmount ?? 5,
        customPrice: null,
      },
    ],
    ingredientShoppingUnits: [
      {
        ingredientId: 'other-ingredient',
        ingredientName: refs.ingredientName,
        unitId: 'other-unit',
        unitName: refs.unitName,
        checked: false,
        cocktailCalculationId: 'exported-id',
      },
    ],
  };
}
