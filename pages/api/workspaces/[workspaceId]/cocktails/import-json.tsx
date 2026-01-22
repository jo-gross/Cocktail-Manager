import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { CocktailExportStructure } from '../../../../../types/CocktailExportStructure';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
    },
  },
};

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: any;
}

interface CocktailMapping {
  exportId: string;
  decision: 'import' | 'skip' | 'rename' | 'overwrite';
  newName?: string;
  overwriteId?: string;
}

interface MappingDecisions {
  glasses: EntityMapping[];
  garnishes: EntityMapping[];
  ingredients: EntityMapping[];
  units: EntityMapping[];
  ice: EntityMapping[];
  stepActions: EntityMapping[];
  cocktails: CocktailMapping[];
}

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const workspaceId = workspace.id;
    const { phase, exportData, mappingDecisions } = req.body as {
      phase: 'validate' | 'prepare-mapping' | 'execute';
      exportData: CocktailExportStructure;
      mappingDecisions?: MappingDecisions;
    };

    try {
      if (phase === 'validate') {
        // Phase 1: Validate JSON structure
        if (!exportData || !exportData.exportVersion || !exportData.cocktailRecipes) {
          return res.status(400).json({
            valid: false,
            errors: ['Ungültige JSON-Struktur'],
          });
        }

        return res.json({
          valid: true,
          cocktailCount: exportData.cocktailRecipes.length,
          cocktails: exportData.cocktailRecipes.map((c) => ({
            id: c.id,
            name: c.name,
          })),
        });
      }

      if (phase === 'prepare-mapping') {
        // Phase 2: Prepare mapping suggestions
        const existingGlasses = await prisma.glass.findMany({
          where: { workspaceId },
          select: { id: true, name: true },
        });

        const existingGarnishes = await prisma.garnish.findMany({
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

        const existingIce = await prisma.ice.findMany({
          where: { workspaceId },
          select: { id: true, name: true },
        });

        const existingStepActions = await prisma.workspaceCocktailRecipeStepAction.findMany({
          where: { workspaceId },
          select: { id: true, name: true, actionGroup: true },
        });

        const existingCocktails = await prisma.cocktailRecipe.findMany({
          where: { workspaceId },
          select: { id: true, name: true },
        });

        // Auto-match based on exact name match (case-insensitive)
        const autoMatchGlasses: EntityMapping[] = [];
        const autoMatchGarnishes: EntityMapping[] = [];
        const autoMatchIngredients: EntityMapping[] = [];
        const autoMatchUnits: EntityMapping[] = [];
        const autoMatchIce: EntityMapping[] = [];
        const autoMatchStepActions: EntityMapping[] = [];

        exportData.glasses.forEach((glass) => {
          const match = existingGlasses.find((e) => e.name.toLowerCase() === glass.name.toLowerCase());
          if (match) {
            autoMatchGlasses.push({
              exportId: glass.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchGlasses.push({
              exportId: glass.id,
              decision: 'create-new',
            });
          }
        });

        exportData.garnishes.forEach((garnish) => {
          const match = existingGarnishes.find((e) => e.name.toLowerCase() === garnish.name.toLowerCase());
          if (match) {
            autoMatchGarnishes.push({
              exportId: garnish.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchGarnishes.push({
              exportId: garnish.id,
              decision: 'create-new',
            });
          }
        });

        exportData.ingredients.forEach((ingredient) => {
          const match = existingIngredients.find((e) => e.name.toLowerCase() === ingredient.name.toLowerCase());
          if (match) {
            autoMatchIngredients.push({
              exportId: ingredient.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchIngredients.push({
              exportId: ingredient.id,
              decision: 'create-new',
            });
          }
        });

        exportData.units.forEach((unit) => {
          const match = existingUnits.find((e) => e.name.toLowerCase() === unit.name.toLowerCase());
          if (match) {
            autoMatchUnits.push({
              exportId: unit.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchUnits.push({
              exportId: unit.id,
              decision: 'create-new',
            });
          }
        });

        exportData.ice.forEach((ice) => {
          const match = existingIce.find((e) => e.name.toLowerCase() === ice.name.toLowerCase());
          if (match) {
            autoMatchIce.push({
              exportId: ice.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchIce.push({
              exportId: ice.id,
              decision: 'create-new',
            });
          }
        });

        exportData.stepActions.forEach((action) => {
          const match = existingStepActions.find((e) => e.name.toLowerCase() === action.name.toLowerCase() && e.actionGroup === action.actionGroup);
          if (match) {
            autoMatchStepActions.push({
              exportId: action.id,
              decision: 'use-existing',
              existingId: match.id,
            });
          } else {
            autoMatchStepActions.push({
              exportId: action.id,
              decision: 'create-new',
            });
          }
        });

        // Detect cocktail conflicts
        const cocktailConflicts = exportData.cocktailRecipes.map((expCocktail) => {
          const conflicts = existingCocktails.filter((existing) => existing.name.toLowerCase() === expCocktail.name.toLowerCase());
          return {
            exportId: expCocktail.id,
            exportName: expCocktail.name,
            conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })),
          };
        });

        return res.json({
          existingMatches: {
            glasses: exportData.glasses.map((g) => ({
              exportId: g.id,
              exportName: g.name,
              matches: existingGlasses.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
            })),
            garnishes: exportData.garnishes.map((g) => ({
              exportId: g.id,
              exportName: g.name,
              matches: existingGarnishes.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
            })),
            ingredients: exportData.ingredients.map((i) => ({
              exportId: i.id,
              exportName: i.name,
              matches: existingIngredients.filter((e) => e.name.toLowerCase().includes(i.name.toLowerCase())),
            })),
            units: exportData.units.map((u) => ({
              exportId: u.id,
              exportName: u.name,
              matches: existingUnits.filter((e) => e.name.toLowerCase() === u.name.toLowerCase()),
            })),
            ice: exportData.ice.map((i) => ({
              exportId: i.id,
              exportName: i.name,
              matches: existingIce.filter((e) => e.name.toLowerCase() === i.name.toLowerCase()),
            })),
            stepActions: exportData.stepActions.map((a) => ({
              exportId: a.id,
              exportName: a.name,
              matches: existingStepActions.filter((e) => e.name.toLowerCase() === a.name.toLowerCase() && e.actionGroup === a.actionGroup),
            })),
          },
          autoMappings: {
            glasses: autoMatchGlasses,
            garnishes: autoMatchGarnishes,
            ingredients: autoMatchIngredients,
            units: autoMatchUnits,
            ice: autoMatchIce,
            stepActions: autoMatchStepActions,
          },
          cocktailConflicts,
        });
      }

      if (phase === 'execute') {
        // Phase 3: Execute import with user decisions
        if (!mappingDecisions) {
          return res.status(400).json({ message: 'Mapping-Entscheidungen fehlen' });
        }

        const imported = {
          cocktails: 0,
          glasses: 0,
          garnishes: 0,
          ingredients: 0,
          units: 0,
          ice: 0,
          stepActions: 0,
        };

        const created = {
          glasses: 0,
          garnishes: 0,
          ingredients: 0,
          units: 0,
          ice: 0,
          stepActions: 0,
        };

        const errors: Array<{ step: string; entityType: string; entityName: string; error: string }> = [];

        try {
          await prisma.$transaction(async (transaction) => {
            // Create ID mappings based on user decisions
            const glassMapping = new Map<string, string>();
            const garnishMapping = new Map<string, string>();
            const ingredientMapping = new Map<string, string>();
            const unitMapping = new Map<string, string>();
            const iceMapping = new Map<string, string>();
            const stepActionMapping = new Map<string, string>();

            // Load existing translations to update within transaction
            const existingTranslationsSetting = await transaction.workspaceSetting.findFirst({
              where: { workspaceId, setting: 'translations' },
            });
            const translationsToUpdate: { [lang: string]: { [key: string]: string } } = JSON.parse(existingTranslationsSetting?.value ?? '{}');

            // Helper to add translation
            const addTranslation = (key: string, lableDE: string) => {
              if (!translationsToUpdate.de) {
                translationsToUpdate.de = {};
              }
              translationsToUpdate.de[key] = lableDE;
            };

            // Process units first
            for (const decision of mappingDecisions.units) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                unitMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                // Use newEntityData if available, otherwise fall back to exportData
                const entityData = decision.newEntityData || exportData.units.find((u) => u.id === decision.exportId);
                if (entityData) {
                  const unitName = entityData.name;
                  try {
                    // Check for unique constraint
                    const existing = await transaction.unit.findFirst({
                      where: { name: unitName, workspaceId },
                    });
                    if (existing) {
                      errors.push({
                        step: 'units',
                        entityType: 'Einheit',
                        entityName: unitName,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      unitMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.unit.create({
                        data: {
                          id: newId,
                          name: unitName,
                          workspaceId,
                        },
                      });
                      // Add translation if provided
                      if (entityData.lableDE) {
                        addTranslation(unitName, entityData.lableDE);
                      }
                      unitMapping.set(decision.exportId, newId);
                      created.units++;
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'units',
                      entityType: 'Einheit',
                      entityName: unitName,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process ice
            for (const decision of mappingDecisions.ice) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                iceMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                const entityData = decision.newEntityData || exportData.ice.find((i) => i.id === decision.exportId);
                if (entityData) {
                  const iceName = entityData.name;
                  try {
                    // Check for unique constraint
                    const existing = await transaction.ice.findFirst({
                      where: { name: iceName, workspaceId },
                    });
                    if (existing) {
                      errors.push({
                        step: 'ice',
                        entityType: 'Eis-Typ',
                        entityName: iceName,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      iceMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.ice.create({
                        data: {
                          id: newId,
                          name: iceName,
                          workspaceId,
                        },
                      });
                      // Add translation if provided
                      if (entityData.lableDE) {
                        addTranslation(iceName, entityData.lableDE);
                      }
                      iceMapping.set(decision.exportId, newId);
                      created.ice++;
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'ice',
                      entityType: 'Eis-Typ',
                      entityName: iceName,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process step actions
            for (const decision of mappingDecisions.stepActions) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                stepActionMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                const entityData = decision.newEntityData || exportData.stepActions.find((a) => a.id === decision.exportId);
                if (entityData) {
                  const actionName = entityData.name;
                  const actionGroup = entityData.actionGroup;
                  try {
                    // Check for unique constraint (name + actionGroup + workspaceId)
                    const existing = await transaction.workspaceCocktailRecipeStepAction.findFirst({
                      where: {
                        name: actionName,
                        actionGroup: actionGroup,
                        workspaceId,
                      },
                    });
                    if (existing) {
                      errors.push({
                        step: 'stepActions',
                        entityType: 'Aktion',
                        entityName: `${actionName} (${actionGroup})`,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      stepActionMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.workspaceCocktailRecipeStepAction.create({
                        data: {
                          id: newId,
                          name: actionName,
                          actionGroup: actionGroup,
                          workspaceId,
                        },
                      });
                      // Add translation if provided
                      if (entityData.lableDE) {
                        addTranslation(actionName, entityData.lableDE);
                      }
                      stepActionMapping.set(decision.exportId, newId);
                      created.stepActions++;
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'stepActions',
                      entityType: 'Aktion',
                      entityName: `${actionName} (${actionGroup})`,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process glasses
            for (const decision of mappingDecisions.glasses) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                glassMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                const entityData = decision.newEntityData || exportData.glasses.find((g) => g.id === decision.exportId);
                if (entityData) {
                  const glassName = entityData.name;
                  try {
                    // Check for unique constraint
                    const existing = await transaction.glass.findFirst({
                      where: { name: glassName, workspaceId },
                    });
                    if (existing) {
                      errors.push({
                        step: 'glasses',
                        entityType: 'Glas',
                        entityName: glassName,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      glassMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.glass.create({
                        data: {
                          id: newId,
                          name: glassName,
                          workspaceId,
                          deposit: entityData.deposit ?? null,
                          volume: entityData.volume ?? null,
                          notes: entityData.notes ?? null,
                        },
                      });
                      glassMapping.set(decision.exportId, newId);
                      created.glasses++;

                      // Import glass images (only from exportData, not from newEntityData)
                      const glassImages = exportData.glassImages.filter((img) => img.glassId === decision.exportId);
                      for (const img of glassImages) {
                        await transaction.glassImage.upsert({
                          where: { glassId: newId },
                          update: { image: img.image },
                          create: {
                            glassId: newId,
                            image: img.image,
                          },
                        });
                      }
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'glasses',
                      entityType: 'Glas',
                      entityName: glassName,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process garnishes
            for (const decision of mappingDecisions.garnishes) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                garnishMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                const entityData = decision.newEntityData || exportData.garnishes.find((g) => g.id === decision.exportId);
                if (entityData) {
                  const garnishName = entityData.name;
                  try {
                    // Check for unique constraint
                    const existing = await transaction.garnish.findFirst({
                      where: { name: garnishName, workspaceId },
                    });
                    if (existing) {
                      errors.push({
                        step: 'garnishes',
                        entityType: 'Garnitur',
                        entityName: garnishName,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      garnishMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.garnish.create({
                        data: {
                          id: newId,
                          name: garnishName,
                          workspaceId,
                          description: entityData.description ?? null,
                          notes: entityData.notes ?? null,
                          price: entityData.price ?? null,
                        },
                      });
                      garnishMapping.set(decision.exportId, newId);
                      created.garnishes++;

                      // Import garnish images (only from exportData)
                      const garnishImages = exportData.garnishImages.filter((img) => img.garnishId === decision.exportId);
                      for (const img of garnishImages) {
                        await transaction.garnishImage.upsert({
                          where: { garnishId: newId },
                          update: { image: img.image },
                          create: {
                            garnishId: newId,
                            image: img.image,
                          },
                        });
                      }
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'garnishes',
                      entityType: 'Garnitur',
                      entityName: garnishName,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process ingredients
            for (const decision of mappingDecisions.ingredients) {
              if (decision.decision === 'use-existing' && decision.existingId) {
                ingredientMapping.set(decision.exportId, decision.existingId);
              } else if (decision.decision === 'create-new') {
                const entityData = decision.newEntityData || exportData.ingredients.find((i) => i.id === decision.exportId);
                if (entityData) {
                  const ingredientName = entityData.name;
                  try {
                    // Check for unique constraint
                    const existing = await transaction.ingredient.findFirst({
                      where: { name: ingredientName, workspaceId },
                    });
                    if (existing) {
                      errors.push({
                        step: 'ingredients',
                        entityType: 'Zutat',
                        entityName: ingredientName,
                        error: 'Existiert bereits (Unique-Constraint)',
                      });
                      ingredientMapping.set(decision.exportId, existing.id);
                    } else {
                      const newId = randomUUID();
                      await transaction.ingredient.create({
                        data: {
                          id: newId,
                          name: ingredientName,
                          workspaceId,
                          shortName: entityData.shortName ?? null,
                          description: entityData.description ?? null,
                          notes: entityData.notes ?? null,
                          price: entityData.price ?? null,
                          link: entityData.link ?? null,
                          tags: entityData.tags ?? [],
                        },
                      });
                      ingredientMapping.set(decision.exportId, newId);
                      created.ingredients++;

                      // Import ingredient images (only from exportData)
                      const ingredientImages = exportData.ingredientImages.filter((img) => img.ingredientId === decision.exportId);
                      for (const img of ingredientImages) {
                        await transaction.ingredientImage.upsert({
                          where: { ingredientId: newId },
                          update: { image: img.image },
                          create: {
                            ingredientId: newId,
                            image: img.image,
                          },
                        });
                      }

                      // Import ingredient volumes (only from exportData)
                      const ingredientVolumes = exportData.ingredientVolumes.filter((vol) => vol.ingredientId === decision.exportId);
                      for (const vol of ingredientVolumes) {
                        const mappedUnitId = unitMapping.get(vol.unitId);
                        if (mappedUnitId) {
                          try {
                            // Check for unique constraint on ingredientVolume (ingredientId + workspaceId + unitId)
                            const existingVolume = await transaction.ingredientVolume.findFirst({
                              where: {
                                ingredientId: newId,
                                unitId: mappedUnitId,
                                workspaceId,
                              },
                            });
                            if (!existingVolume) {
                              await transaction.ingredientVolume.create({
                                data: {
                                  id: randomUUID(),
                                  ingredientId: newId,
                                  unitId: mappedUnitId,
                                  volume: vol.volume,
                                  workspaceId,
                                },
                              });
                            }
                          } catch (volErr: any) {
                            errors.push({
                              step: 'ingredientVolumes',
                              entityType: 'Zutaten-Volumen',
                              entityName: ingredientName,
                              error: volErr.message || 'Fehler beim Erstellen des Volumens',
                            });
                          }
                        }
                      }
                    }
                  } catch (err: any) {
                    errors.push({
                      step: 'ingredients',
                      entityType: 'Zutat',
                      entityName: ingredientName,
                      error: err.message || 'Unbekannter Fehler',
                    });
                  }
                }
              }
            }

            // Process cocktails
            for (const decision of mappingDecisions.cocktails) {
              if (decision.decision === 'skip') {
                continue;
              }

              const exportCocktail = exportData.cocktailRecipes.find((c) => c.id === decision.exportId);
              if (!exportCocktail) continue;

              try {
                let cocktailId: string;
                const cocktailName = decision.decision === 'rename' && decision.newName ? decision.newName : exportCocktail.name;

                if (decision.decision === 'overwrite' && decision.overwriteId) {
                  cocktailId = decision.overwriteId;
                  // Delete existing cocktail data
                  await transaction.cocktailRecipeIngredient.deleteMany({
                    where: {
                      cocktailRecipeStep: {
                        cocktailRecipeId: cocktailId,
                      },
                    },
                  });
                  await transaction.cocktailRecipeGarnish.deleteMany({
                    where: { cocktailRecipeId: cocktailId },
                  });
                  await transaction.cocktailRecipeStep.deleteMany({
                    where: { cocktailRecipeId: cocktailId },
                  });
                  await transaction.cocktailRecipeImage.deleteMany({
                    where: { cocktailRecipeId: cocktailId },
                  });
                  await transaction.cocktailRecipe.delete({
                    where: { id: cocktailId },
                  });
                }

                cocktailId = decision.decision === 'overwrite' ? decision.overwriteId! : randomUUID();

                // Create cocktail
                const mappedGlassId = exportCocktail.glassId ? glassMapping.get(exportCocktail.glassId) : null;
                const mappedIceId = exportCocktail.iceId ? iceMapping.get(exportCocktail.iceId) : null;

                await transaction.cocktailRecipe.create({
                  data: {
                    id: cocktailId,
                    name: cocktailName,
                    workspaceId,
                    glassId: mappedGlassId || null,
                    iceId: mappedIceId || null,
                    price: exportCocktail.price,
                    tags: exportCocktail.tags,
                    description: exportCocktail.description,
                    isArchived: exportCocktail.isArchived,
                    history: exportCocktail.history,
                    notes: exportCocktail.notes,
                  },
                });
                imported.cocktails++;

                // Import cocktail images
                const cocktailImages = exportData.cocktailRecipeImages.filter((img) => img.cocktailRecipeId === decision.exportId);
                for (const img of cocktailImages) {
                  await transaction.cocktailRecipeImage.upsert({
                    where: { cocktailRecipeId: cocktailId },
                    update: { image: img.image },
                    create: {
                      cocktailRecipeId: cocktailId,
                      image: img.image,
                    },
                  });
                }

                // Import cocktail steps
                const cocktailSteps = exportData.cocktailRecipeSteps.filter((step) => step.cocktailRecipeId === decision.exportId);
                const stepMapping = new Map<string, string>();

                for (const step of cocktailSteps) {
                  const newStepId = randomUUID();
                  stepMapping.set(step.id, newStepId);

                  const mappedActionId = step.actionId ? stepActionMapping.get(step.actionId) : undefined;

                  if (mappedActionId) {
                    await transaction.cocktailRecipeStep.create({
                      data: {
                        id: newStepId,
                        cocktailRecipeId: cocktailId,
                        stepNumber: step.stepNumber,
                        actionId: mappedActionId,
                        optional: step.optional,
                      },
                    });
                  }
                }

                // Import cocktail ingredients
                const cocktailIngredients = exportData.cocktailRecipeIngredients.filter((ing) => {
                  const stepId = ing.cocktailRecipeStepId;
                  return cocktailSteps.some((s) => s.id === stepId);
                });

                for (const ing of cocktailIngredients) {
                  const mappedStepId = stepMapping.get(ing.cocktailRecipeStepId);
                  const mappedIngredientId = ing.ingredientId ? ingredientMapping.get(ing.ingredientId) : undefined;
                  const mappedUnitId = ing.unitId ? unitMapping.get(ing.unitId) : undefined;

                  if (mappedStepId) {
                    await transaction.cocktailRecipeIngredient.create({
                      data: {
                        id: randomUUID(),
                        cocktailRecipeStepId: mappedStepId,
                        ...(mappedIngredientId && { ingredientId: mappedIngredientId }),
                        ingredientNumber: ing.ingredientNumber,
                        optional: ing.optional,
                        amount: ing.amount,
                        ...(mappedUnitId && { unitId: mappedUnitId }),
                      },
                    });
                  }
                }

                // Import cocktail garnishes
                const cocktailGarnishes = exportData.cocktailRecipeGarnishes.filter((g) => g.cocktailRecipeId === decision.exportId);
                for (const g of cocktailGarnishes) {
                  const mappedGarnishId = garnishMapping.get(g.garnishId);
                  if (mappedGarnishId) {
                    await transaction.cocktailRecipeGarnish.create({
                      data: {
                        cocktailRecipeId: cocktailId,
                        garnishId: mappedGarnishId,
                        garnishNumber: g.garnishNumber,
                        optional: g.optional,
                        description: g.description,
                      },
                    });
                  }
                }
              } catch (err: any) {
                errors.push({
                  step: 'cocktails',
                  entityType: 'Cocktail',
                  entityName: exportCocktail.name,
                  error: err.message || 'Unbekannter Fehler',
                });
              }
            }

            // Update translations at the end of transaction
            if (Object.keys(translationsToUpdate).length > 0) {
              await transaction.workspaceSetting.upsert({
                where: {
                  workspaceId_setting: {
                    setting: 'translations',
                    workspaceId,
                  },
                },
                create: {
                  workspaceId,
                  setting: 'translations',
                  value: JSON.stringify(translationsToUpdate),
                },
                update: {
                  value: JSON.stringify(translationsToUpdate),
                },
              });
            }
          });

          return res.json({
            success: true,
            imported,
            created,
            ...(errors.length > 0 && { errors }),
          });
        } catch (transactionError: any) {
          console.error('Transaction error:', transactionError);
          return res.status(500).json({
            message: 'Fehler beim Importieren der Cocktails',
            errors:
              errors.length > 0
                ? errors
                : [{ step: 'transaction', entityType: 'System', entityName: '', error: transactionError.message || 'Transaktionsfehler' }],
          });
        }
      }

      return res.status(400).json({ message: 'Ungültige Phase' });
    } catch (error: any) {
      console.error('Import error:', error);
      return res.status(500).json({ message: error.message || 'Fehler beim Importieren der Cocktails' });
    }
  }),
});
