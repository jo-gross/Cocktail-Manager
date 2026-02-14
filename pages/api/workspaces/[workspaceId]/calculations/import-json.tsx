import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { CocktailCalculationExportStructure } from '../../../../../lib/auditExport';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

interface EntityDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  data: any;
}

interface EntityMapping {
  exportName: string;
  decision: 'use-existing' | 'skip';
  existingId?: string;
}

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.CALCULATIONS_READ,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { phase, exportData, decisions, cocktailMappings, ingredientMappings, unitMappings } = req.body as {
        phase: 'validate' | 'prepare-mapping' | 'execute';
        exportData: CocktailCalculationExportStructure | CocktailCalculationExportStructure[];
        decisions?: EntityDecision[];
        cocktailMappings?: EntityMapping[];
        ingredientMappings?: EntityMapping[];
        unitMappings?: EntityMapping[];
      };

      const workspaceId = workspace.id;

      try {
        const items: CocktailCalculationExportStructure[] = Array.isArray(exportData) ? exportData : [exportData];

        if (phase === 'validate') {
          const entities = items.map((item) => {
            if (!item?.calculation?.name) {
              return { name: 'Unbekannt', valid: false };
            }
            return { name: item.calculation.name, valid: true };
          });

          return res.json({ valid: entities.every((e) => e.valid), entities });
        }

        if (phase === 'prepare-mapping') {
          const existingCalculations = await prisma.cocktailCalculation.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          const existingIngredients = await prisma.ingredient.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          const existingUnits = await prisma.unit.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          const existingCocktails = await prisma.cocktailRecipe.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          // Calculation conflicts
          const entities = items.map((item) => {
            const name = item.calculation?.name || 'Unbekannt';
            const conflicts = existingCalculations.filter((e) => e.name.toLowerCase() === name.toLowerCase());
            return {
              name,
              data: item,
              conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })),
            };
          });

          // Collect all referenced ingredient and unit names across all items
          const referencedIngredientNames = new Set<string>();
          const referencedUnitNames = new Set<string>();
          const referencedCocktailNames = new Set<string>();

          for (const item of items) {
            if (item.ingredientShoppingUnits) {
              for (const su of item.ingredientShoppingUnits) {
                if (su.ingredientName) referencedIngredientNames.add(su.ingredientName);
                if (su.unitName) referencedUnitNames.add(su.unitName);
              }
            }
            if (item.cocktailCalculationItems) {
              for (const ci of item.cocktailCalculationItems) {
                if (ci.cocktailName) referencedCocktailNames.add(ci.cocktailName);
              }
            }
          }

          // Auto-match ingredients
          const ingredientMatches = Array.from(referencedIngredientNames).map((name) => {
            const match = existingIngredients.find((e) => e.name.toLowerCase() === name.toLowerCase());
            return {
              exportName: name,
              autoMatch: match ? { id: match.id, name: match.name } : null,
              options: existingIngredients.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
            };
          });

          // Auto-match units
          const unitMatches = Array.from(referencedUnitNames).map((name) => {
            const match = existingUnits.find((e) => e.name.toLowerCase() === name.toLowerCase());
            return {
              exportName: name,
              autoMatch: match ? { id: match.id, name: match.name } : null,
              options: existingUnits.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
            };
          });

          // Auto-match cocktails
          const cocktailMatches = Array.from(referencedCocktailNames).map((name) => {
            const match = existingCocktails.find((e) => e.name.toLowerCase() === name.toLowerCase());
            return {
              exportName: name,
              autoMatch: match ? { id: match.id, name: match.name } : null,
              options: existingCocktails.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
            };
          });

          return res.json({
            entities,
            ingredientMatches,
            unitMatches,
            cocktailMatches,
          });
        }

        if (phase === 'execute') {
          if (!decisions || decisions.length === 0) {
            return res.status(400).json({ message: 'Keine Entscheidungen angegeben' });
          }

          // Build cocktail name -> ID mapping
          const cocktailNameToId = new Map<string, string>();
          if (cocktailMappings) {
            for (const m of cocktailMappings) {
              if (m.decision === 'use-existing' && m.existingId) {
                cocktailNameToId.set(m.exportName.toLowerCase(), m.existingId);
              }
            }
          }

          // Build ingredient name -> ID mapping
          const ingredientNameToId = new Map<string, string>();
          if (ingredientMappings) {
            for (const m of ingredientMappings) {
              if (m.decision === 'use-existing' && m.existingId) {
                ingredientNameToId.set(m.exportName.toLowerCase(), m.existingId);
              }
            }
          }

          // Build unit name -> ID mapping
          const unitNameToId = new Map<string, string>();
          if (unitMappings) {
            for (const m of unitMappings) {
              if (m.decision === 'use-existing' && m.existingId) {
                unitNameToId.set(m.exportName.toLowerCase(), m.existingId);
              }
            }
          }

          const results: Array<{ name: string; status: string; message?: string }> = [];

          await prisma.$transaction(async (tx) => {
            // Also lookup any ingredients/units by name in workspace as fallback
            const existingIngredients = await tx.ingredient.findMany({
              where: { workspaceId },
              select: { id: true, name: true },
            });
            const existingUnits = await tx.unit.findMany({
              where: { workspaceId },
              select: { id: true, name: true },
            });
            const existingCocktails = await tx.cocktailRecipe.findMany({
              where: { workspaceId },
              select: { id: true, name: true },
            });

            for (const decision of decisions) {
              if (decision.decision === 'skip') {
                results.push({ name: decision.exportName, status: 'skipped' });
                continue;
              }

              const itemData = decision.data as CocktailCalculationExportStructure;
              if (!itemData?.calculation) continue;

              const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.calculation.name;

              try {
                let calcId: string;

                if (decision.decision === 'overwrite' && decision.existingId) {
                  // Delete old items
                  await tx.cocktailCalculationItems.deleteMany({
                    where: { calculationId: decision.existingId },
                  });
                  await tx.calculationIngredientShoppingUnit.deleteMany({
                    where: { cocktailCalculationId: decision.existingId },
                  });

                  await tx.cocktailCalculation.update({
                    where: { id: decision.existingId },
                    data: {
                      name: finalName,
                      showSalesStuff: itemData.calculation.showSalesStuff ?? false,
                      updatedByUserId: user.id,
                    },
                  });

                  calcId = decision.existingId;
                } else {
                  const created = await tx.cocktailCalculation.create({
                    data: {
                      name: finalName,
                      showSalesStuff: itemData.calculation.showSalesStuff ?? false,
                      workspaceId,
                      updatedByUserId: user.id,
                    },
                  });
                  calcId = created.id;
                }

                // Import calculation items (cocktails) – only link when explicitly mapped (use-existing)
                if (itemData.cocktailCalculationItems) {
                  for (const ci of itemData.cocktailCalculationItems) {
                    const cocktailName = ci.cocktailName;
                    const mappedId = cocktailNameToId.get(cocktailName.toLowerCase());
                    if (!mappedId) continue; // Skipped or unmapped: do not add to calculation
                    const cocktail = existingCocktails.find((c) => c.id === mappedId);
                    if (!cocktail) continue;

                    await tx.cocktailCalculationItems.create({
                      data: {
                        calculationId: calcId,
                        cocktailId: cocktail.id,
                        plannedAmount: ci.plannedAmount,
                        customPrice: ci.customPrice ?? null,
                      },
                    });
                  }
                }

                // Import shopping units
                if (itemData.ingredientShoppingUnits) {
                  for (const su of itemData.ingredientShoppingUnits) {
                    // Resolve ingredient: user mapping > name match
                    let ingredientId = ingredientNameToId.get(su.ingredientName.toLowerCase());
                    if (!ingredientId) {
                      const match = existingIngredients.find((i) => i.name.toLowerCase() === su.ingredientName.toLowerCase());
                      ingredientId = match?.id;
                    }
                    if (!ingredientId) continue;

                    // Resolve unit: user mapping > name match > create
                    let unitId = unitNameToId.get(su.unitName.toLowerCase());
                    if (!unitId) {
                      const match = existingUnits.find((u) => u.name.toLowerCase() === su.unitName.toLowerCase());
                      if (match) {
                        unitId = match.id;
                      } else {
                        const newUnit = await tx.unit.create({
                          data: { name: su.unitName, workspaceId },
                        });
                        unitId = newUnit.id;
                        existingUnits.push({ id: newUnit.id, name: su.unitName });
                      }
                    }

                    await tx.calculationIngredientShoppingUnit.create({
                      data: {
                        cocktailCalculationId: calcId,
                        ingredientId,
                        unitId,
                        checked: su.checked ?? false,
                      },
                    });
                  }
                }

                const fullResult = await tx.cocktailCalculation.findUnique({
                  where: { id: calcId },
                  include: {
                    cocktailCalculationItems: {
                      include: { cocktail: { select: { name: true } } },
                    },
                    ingredientShoppingUnits: {
                      include: {
                        ingredient: { select: { name: true } },
                        unit: { select: { name: true } },
                      },
                    },
                  },
                });

                const action = decision.decision === 'overwrite' ? 'UPDATE' : 'CREATE';
                await createLog(tx, workspaceId, user.id, 'CocktailCalculation', calcId, action as any, null, fullResult);
                results.push({ name: finalName, status: decision.decision === 'overwrite' ? 'overwritten' : 'created' });
              } catch (err: any) {
                results.push({ name: finalName, status: 'error', message: err.message });
              }
            }
          });

          return res.json({ success: true, results });
        }

        return res.status(400).json({ message: 'Ungültige Phase' });
      } catch (error: any) {
        console.error('Calculation import error:', error);
        return res.status(500).json({ message: error.message || 'Import failed' });
      }
    },
  ),
});
