import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure } from './backupStructure';
import prisma from '../../../../../../prisma/prisma';
import { randomUUID } from 'crypto';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

function convertUnit(unit: string): string {
  switch (unit) {
    case 'cl':
      return 'CL';
    case 'Dash':
      return 'DASH';
    case 'Stück':
      return 'PIECE';
    case 'Pip. cm':
      return 'DROPPER_CM';
    case 'Pip. Tropfen':
      return 'DROPPER_DROPS';
    case 'Pin. cm':
      return 'DROPPER_CM';
    case 'Pin. Tropfen':
      return 'DROPPER_DROPS';
    case 'Sprühen':
      return 'SPRAY';
    case 'g':
      return 'GRAMM';
    default:
      return 'Unknown';
  }
}

function convertIce(ice: string): string {
  switch (ice) {
    case 'Crushed':
      return 'ICE_CRUSHED';
    case 'Würfel':
      return 'ICE_CUBES';
    case 'Kugel':
      return 'ICE_BALL';
    case 'Ohne':
      return 'WITHOUT_ICE';
    default:
      return ice;
  }
}

export default withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  console.debug('Importing workspace', workspaceId);

  if (req.method === 'POST') {
    try {
      await prisma.$transaction(async (transaction) => {
        const data: BackupStructure = JSON.parse(await req.body);

        if (data.workspaceSettings?.length > 0) {
          console.debug('Importing workspaceSettings', data.workspaceSettings?.length);
          data.workspaceSettings?.forEach((g) => {
            g.workspaceId = workspaceId;
          });
          await transaction.workspaceSetting.createMany({ data: data.workspaceSettings, skipDuplicates: true });
        }

        const unitMapping: { id: string; newId: string }[] = [];
        if (data.units?.length > 0) {
          console.debug('Importing units', data.units?.length);

          for (const g of data.units) {
            const existingUnit = await transaction.unit.findFirst({
              where: { name: g.name, workspaceId: workspaceId },
            });
            if (existingUnit == null) {
              g.id = randomUUID();
              g.workspaceId = workspaceId;
              await transaction.unit.create({ data: g });
              unitMapping.push({ id: g.id, newId: g.id });
            } else {
              unitMapping.push({ id: g.id, newId: existingUnit.id });
            }
          }
        }

        if (data.unitConversions?.length > 0) {
          console.debug('Importing unitConversions', data.unitConversions?.length);

          for (const g of data.unitConversions) {
            const newFromId = unitMapping.find((gm) => gm.id === g.fromUnitId)?.newId;
            const newToId = unitMapping.find((gm) => gm.id === g.toUnitId)?.newId;
            if (newFromId != undefined && newToId != undefined) {
              const existingUnitConversion = await transaction.unitConversion.findFirst({
                where: {
                  workspaceId: workspaceId,
                  fromUnitId: newFromId,
                  toUnitId: newToId,
                },
              });
              if (existingUnitConversion == null) {
                g.fromUnitId = newFromId;
                g.toUnitId = newToId;
                g.workspaceId = workspaceId;
                await transaction.unitConversion.create({ data: g });
              }
            }
          }
        }

        const actionMapping: { id: string; newId: string }[] = [];
        if (data.stepActions?.length > 0) {
          console.debug('Importing stepActions', data.stepActions?.length);
          for (const g of data.stepActions) {
            const existingAction = await transaction.workspaceCocktailRecipeStepAction.findFirst({
              where: { name: g.name, workspaceId: workspaceId, actionGroup: g.actionGroup },
            });
            if (existingAction == null) {
              const newId = randomUUID();
              actionMapping.push({ id: g.id, newId: newId });
              g.id = newId;
              g.workspaceId = workspaceId;

              await transaction.workspaceCocktailRecipeStepAction.create({ data: g });
            } else {
              actionMapping.push({ id: g.id, newId: existingAction.id });
            }
          }
        }

        const actions = await transaction.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId } });

        const garnishMapping: { id: string; newId: string }[] = [];
        const garnishImageMapping: { garnishId: string; image: string }[] = [];
        if (data.garnish?.length > 0) {
          console.debug('Importing garnishes', data.garnish?.length);
          data.garnish?.forEach((g) => {
            const garnishMappingItem = { id: g.id, newId: randomUUID() };
            // @ts-ignore causing older backup version support
            if (g.image != undefined) {
              // @ts-ignore causing older backup version support
              garnishImageMapping.push({ garnishId: garnishMappingItem.newId, image: g.image });
            }
            g.id = garnishMappingItem.newId;
            g.workspaceId = workspaceId;
            // @ts-ignore causing older backup version support
            g.image = undefined;
            garnishMapping.push(garnishMappingItem);
          });
          await transaction.garnish.createMany({ data: data.garnish, skipDuplicates: true });
        }
        if (data.garnishImages?.length > 0) {
          for (const image of data.garnishImages) {
            const garnish = garnishMapping.find((gm) => gm.id === image.garnishId);
            if (garnish) {
              garnishImageMapping.push({ garnishId: garnish.newId, image: image.image });
            }
          }
        }
        await transaction.garnishImage.createMany({ data: garnishImageMapping, skipDuplicates: true });

        const ingredientMapping: { id: string; newId: string }[] = [];
        const ingredientImageMapping: { ingredientId: string; image: string }[] = [];

        const oldVolumes: { ingredientId: string; unitId: string; volume: number }[] = [];

        if (data.ingredient?.length > 0) {
          console.debug('Importing ingredients', data.ingredient?.length);

          for (const g of data.ingredient) {
            const ingredientMappingItem = { id: g.id, newId: randomUUID() };
            // @ts-ignore causing older backup version support
            if (g.image != undefined) {
              // @ts-ignore causing older backup version support
              ingredientImageMapping.push({ ingredientId: ingredientMappingItem.newId, image: g.image });
            }
            g.id = ingredientMappingItem.newId;
            g.workspaceId = workspaceId;
            // @ts-ignore causing older backup version support
            g.image = undefined;
            // Enable older backup imports
            // @ts-ignore causing older backup version support
            if (g.volume != undefined && g.unit != undefined) {
              // @ts-ignore causing older backup version support
              const unitIdentifier = convertUnit(g.unit);
              // @ts-ignore causing older backup version support
              console.log('Unit identifier', unitIdentifier, g.unit, g.volume, g.name);
              // @ts-ignore causing older backup version support
              const unit = await transaction.unit.findFirst({ where: { name: unitIdentifier, workspaceId: workspaceId } });
              let unitId = unit?.id;
              if (unitId == undefined) {
                unitId = randomUUID();
                console.log('unitId', unitId, unitIdentifier, workspaceId);
                await transaction.unit.create({ data: { id: unitId, name: unitIdentifier, workspaceId: workspaceId } });
              }
              oldVolumes.push({
                ingredientId: g.id,
                // @ts-ignore causing older backup version support
                volume: g.volume,
                unitId: unitId,
              });
            }
            // @ts-ignore causing older backup version support
            g.volume = undefined;
            // @ts-ignore causing older backup version support
            g.unit = undefined;
            ingredientMapping.push(ingredientMappingItem);
          }
          await transaction.ingredient.createMany({ data: data.ingredient, skipDuplicates: true });
        }
        console.log('Old ingredients volumes', oldVolumes);
        if (data.ingredientImages?.length > 0) {
          for (const image of data.ingredientImages) {
            const ingredient = ingredientMapping.find((gm) => gm.id === image.ingredientId);
            if (ingredient) {
              ingredientImageMapping.push({ ingredientId: ingredient.newId, image: image.image });
            }
          }
        }
        for (const volume of oldVolumes) {
          if (volume.unitId != undefined) {
            await transaction.ingredientVolume.create({
              data: {
                id: randomUUID(),
                ingredientId: volume.ingredientId,
                unitId: volume.unitId,
                volume: volume.volume,
                workspaceId: workspaceId,
              },
            });
          }
        }
        if (data.ingredientVolumes?.length > 0) {
          for (const volume of data.ingredientVolumes) {
            const newIngredientId = ingredientMapping.find((gm) => gm.id === volume.ingredientId)?.newId;
            const newUnitId = unitMapping.find((gm) => gm.id === volume.unitId)?.newId;

            if (newIngredientId != undefined && newUnitId != undefined) {
              const existingVolume = await transaction.ingredientVolume.findFirst({
                where: {
                  ingredientId: newIngredientId,
                  unitId: newUnitId,
                  workspaceId: workspaceId,
                },
              });
              if (existingVolume == null) {
                volume.id = randomUUID();
                volume.ingredientId = newIngredientId;
                volume.unitId = newUnitId;
                volume.workspaceId = workspaceId;
                await transaction.ingredientVolume.create({ data: volume });
              }
            }
          }
        }
        await transaction.ingredientImage.createMany({ data: ingredientImageMapping, skipDuplicates: true });

        const glassMapping: { id: string; newId: string }[] = [];
        const glassImageMapping: { glassId: string; image: string }[] = [];
        if (data.glass?.length > 0) {
          console.debug('Importing glasses', data.glass?.length);
          data.glass?.forEach((g) => {
            const glassMappingItem = { id: g.id, newId: randomUUID() };
            // @ts-ignore causing older backup version support
            if (g.image != undefined) {
              // @ts-ignore causing older backup version support
              glassImageMapping.push({ glassId: glassMappingItem.newId, image: g.image });
            }
            g.id = glassMappingItem.newId;
            g.workspaceId = workspaceId;
            // @ts-ignore causing older backup version support
            g.image = undefined;
            glassMapping.push(glassMappingItem);
          });
          await transaction.glass.createMany({ data: data.glass, skipDuplicates: true });
        }
        if (data.glassImages?.length > 0) {
          for (const image of data.glassImages) {
            const glass = glassMapping.find((gm) => gm.id === image.glassId);
            if (glass) {
              glassImageMapping.push({ glassId: glass.newId, image: image.image });
            }
          }
        }
        await transaction.glassImage.createMany({ data: glassImageMapping, skipDuplicates: true });

        const iceMapping: { id: string; newId: string }[] = [];
        if (data.ice?.length > 0) {
          console.debug('Importing ice', data.ice?.length);
          for (const ice of data.ice) {
            const existing = (await transaction.ice.findFirst({ where: { workspaceId: workspaceId, name: ice.name } }))?.id;
            if (existing) {
              iceMapping.push({ id: ice.id, newId: existing });
            }
          }
          data.ice?.forEach((i) => {
            const iceMappingItem = { id: i.id, newId: randomUUID() };
            i.id = iceMappingItem.newId;
            i.workspaceId = workspaceId;
            iceMapping.push(iceMappingItem);
          });
          await transaction.ice.createMany({ data: data.ice, skipDuplicates: true });
        }

        // ensure that all oldIce is imported
        let oldIceMapping: { name: string; newId: string }[] = [];
        if (data.cocktailRecipe?.length > 0) {
          for (const cocktail of data.cocktailRecipe) {
            // @ts-ignore causing older backup version support
            if (cocktail.glassWithIce != undefined) {
              // @ts-ignore causing older backup version support
              const iceIdentifier = convertIce(cocktail.glassWithIce);
              if (oldIceMapping.find((ice) => ice.name == iceIdentifier) == undefined) {
                const ice = await transaction.ice.findFirst({ where: { name: iceIdentifier, workspaceId: workspaceId } });
                if (ice == undefined) {
                  const result = await transaction.ice.create({ data: { id: randomUUID(), name: iceIdentifier, workspaceId: workspaceId } });
                  oldIceMapping = [...oldIceMapping, { name: iceIdentifier, newId: result.id }];
                } else {
                  oldIceMapping = [...oldIceMapping, { name: iceIdentifier, newId: ice.id }];
                }
              }
            }
          }
        }
        console.log('Importing old ice', oldIceMapping.length);

        const cocktailRecipeMapping: { id: string; newId: string }[] = [];
        const cocktailRecipeImageMapping: { cocktailRecipeId: string; image: string }[] = [];
        if (data.cocktailRecipe?.length > 0) {
          // console.debug('Importing cocktailRecipes', data.cocktailRecipe?.length);
          data.cocktailRecipe?.forEach((g) => {
            const cocktailRecipeMappingItem = { id: g.id, newId: randomUUID() };
            // @ts-ignore causing older backup version support
            if (g.image != undefined) {
              // @ts-ignore causing older backup version support
              cocktailRecipeImageMapping.push({ cocktailRecipeId: cocktailRecipeMappingItem.newId, image: g.image });
            }
            g.id = cocktailRecipeMappingItem.newId;
            // @ts-ignore causing older backup version support
            g.iceId = iceMapping.find((ice) => ice.id === g.iceId)?.newId;
            if (g.iceId == undefined) {
              // @ts-ignore causing older backup version support
              g.iceId = oldIceMapping.find((ice) => ice.name == convertIce(g.glassWithIce))?.newId;

              if (g.iceId == undefined) {
                console.error('IceId is undefined', g);
                throw new Error('IceId is undefined');
              }
            }
            g.glassId = glassMapping.find((gm) => gm.id === g.glassId)?.newId!;
            g.workspaceId = workspaceId;
            // @ts-ignore causing older backup version support
            g.image = undefined;
            // @ts-ignore causing older backup version support
            g.glassWithIce = undefined;
            cocktailRecipeMapping.push(cocktailRecipeMappingItem);
          });

          await Promise.all(
            data.cocktailRecipe.map(async (g) => {
              if ((await transaction.ice.findFirst({ where: { id: g.iceId! } })) == null) {
                console.error('Ice not found', g.iceId);
                const ice = (await transaction.ice.findMany({ where: { workspaceId: workspaceId } })).filter((i) => i.id == g.iceId);
                console.log('Ice', ice);
                console.error('Cocktail', g.name);
              }
            }),
          );

          await transaction.cocktailRecipe.createMany({ data: data.cocktailRecipe, skipDuplicates: true });
        }
        if (data.cocktailRecipeImage?.length > 0) {
          for (const image of data.cocktailRecipeImage) {
            const cocktail = cocktailRecipeMapping.find((gm) => gm.id === image.cocktailRecipeId);
            if (cocktail) {
              cocktailRecipeImageMapping.push({ cocktailRecipeId: cocktail.newId, image: image.image });
            }
          }
        }
        await transaction.cocktailRecipeImage.createMany({ data: cocktailRecipeImageMapping, skipDuplicates: true });

        const cocktailRecipeStepMapping: { id: string; newId: string }[] = [];
        if (data.cocktailRecipeStep?.length > 0) {
          console.debug('Importing cocktailRecipeSteps', data.cocktailRecipeStep?.length);
          data.cocktailRecipeStep?.forEach((g) => {
            const cocktailRecipeStepMappingItem = { id: g.id, newId: randomUUID() };
            g.id = cocktailRecipeStepMappingItem.newId;
            g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)?.newId!;
            cocktailRecipeStepMapping.push(cocktailRecipeStepMappingItem);
          });
          const cocktailRecipeSteps = data.cocktailRecipeStep?.map((step) => {
            if (step.actionId == undefined) {
              return {
                id: step.id,
                stepNumber: step.stepNumber,
                cocktailRecipeId: step.cocktailRecipeId,
                actionId: actions.find(
                  // @ts-ignore - For old versions, where the actionId does not exist
                  (action) => action.name == (step.tool == 'PESTLE' ? 'MUDDLE' : step.tool == 'POUR' ? 'WITHOUT' : step.tool),
                )?.id!,
              };
            } else {
              step.actionId = actionMapping.find((gm) => gm.id === step.actionId)?.newId!;
            }
            return step;
          });
          await transaction.cocktailRecipeStep.createMany({ data: cocktailRecipeSteps, skipDuplicates: true });
        }

        if (data.cocktailRecipeGarnish?.length > 0) {
          console.debug('Importing cocktailRecipeGarnish', data.cocktailRecipeGarnish?.length);
          data.cocktailRecipeGarnish?.forEach((g) => {
            g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)?.newId!;
            g.garnishId = garnishMapping.find((gm) => gm.id === g.garnishId)?.newId!;
          });

          await transaction.cocktailRecipeGarnish.createMany({
            data: data.cocktailRecipeGarnish,
            skipDuplicates: true,
          });
        }
        if (data.cocktailRecipeIngredient?.length > 0) {
          console.debug('Importing cocktailRecipeIngredient', data.cocktailRecipeIngredient?.length);
          for (const g of data.cocktailRecipeIngredient) {
            g.id = randomUUID();
            g.cocktailRecipeStepId = cocktailRecipeStepMapping.find((gm) => gm.id === g.cocktailRecipeStepId)?.newId!;
            g.ingredientId = ingredientMapping.find((gm) => gm.id === g.ingredientId)?.newId!;
            if (g.unitId != undefined) {
              g.unitId = unitMapping.find((gm) => gm.id === g.unitId)?.newId!;
            }
            // @ts-ignore causing older backup version support
            if (g.unit != undefined) {
              // @ts-ignore causing older backup version support
              const unitIdentifier = convertUnit(g.unit);
              const unit = await transaction.unit.findFirst({ where: { name: unitIdentifier, workspaceId: workspaceId } });
              let unitId = unit?.id;
              if (unitId == undefined) {
                unitId = randomUUID();
                console.log('unitId', unitId, unitIdentifier, workspaceId);
                await transaction.unit.create({ data: { id: unitId, name: unitIdentifier, workspaceId: workspaceId } });
              }
              g.unitId = unitId;
            }
            // @ts-ignore causing older backup version support
            g.unit = undefined;
          }
          await transaction.cocktailRecipeIngredient.createMany({
            data: data.cocktailRecipeIngredient,
            skipDuplicates: true,
          });
        }

        const cocktailCardMapping: { id: string; newId: string }[] = [];
        if (data.cocktailCard?.length > 0) {
          console.debug('Importing cocktailCard', data.cocktailCard?.length);
          data.cocktailCard?.forEach((g) => {
            const cocktailCardMappingItem = { id: g.id, newId: randomUUID() };
            g.id = cocktailCardMappingItem.newId;
            g.workspaceId = workspaceId;
            cocktailCardMapping.push(cocktailCardMappingItem);
          });
          await transaction.cocktailCard.createMany({ data: data.cocktailCard, skipDuplicates: true });
        }

        const cocktailCardGroupMapping: { id: string; newId: string }[] = [];
        if (data.cocktailCardGroup?.length > 0) {
          console.debug('Importing cocktailCardGroup', data.cocktailCardGroup?.length);
          data.cocktailCardGroup?.forEach((g) => {
            const cocktailCardGroupMappingItem = { id: g.id, newId: randomUUID() };
            g.id = cocktailCardGroupMappingItem.newId;
            g.cocktailCardId = cocktailCardMapping.find((gm) => gm.id === g.cocktailCardId)?.newId!;
            cocktailCardGroupMapping.push(cocktailCardGroupMappingItem);
          });
          await transaction.cocktailCardGroup.createMany({ data: data.cocktailCardGroup, skipDuplicates: true });
        }

        if (data.cocktailCardGroupItem?.length > 0) {
          console.debug('Importing cocktailCardGroupItem', data.cocktailCardGroupItem?.length);
          data.cocktailCardGroupItem?.forEach((g) => {
            g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)?.newId!;
            g.cocktailCardGroupId = cocktailCardGroupMapping.find((gm) => gm.id === g.cocktailCardGroupId)?.newId!;
          });
          await transaction.cocktailCardGroupItem.createMany({
            data: data.cocktailCardGroupItem,
            skipDuplicates: true,
          });
        }

        const cocktailCalculationMapping: { id: string; newId: string }[] = [];
        if (data.calculation?.length > 0) {
          console.debug('Importing cocktailCardGroupItem', data.calculation?.length);
          data.calculation?.forEach((g) => {
            const cocktailCalculationMappingItem = { id: g.id, newId: randomUUID() };
            g.id = cocktailCalculationMappingItem.newId;
            g.workspaceId = workspaceId;
            g.updatedByUserId = user.id;
            cocktailCalculationMapping.push(cocktailCalculationMappingItem);
          });
          await transaction.cocktailCalculation.createMany({ data: data.calculation, skipDuplicates: true });
        }

        if (data.calculationItems?.length > 0) {
          console.debug('Importing cocktailCardGroupItem', data.cocktailCardGroupItem?.length);
          data.calculationItems?.forEach((g) => {
            g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)?.newId!;
            g.calculationId = cocktailCalculationMapping.find((gm) => gm.id === g.calculationId)?.newId!;
          });
          await transaction.cocktailCalculationItems.createMany({ data: data.calculationItems, skipDuplicates: true });
        }

        console.info('Import finished');
      });

      return res.status(200).json({ msg: 'Success' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }
});
