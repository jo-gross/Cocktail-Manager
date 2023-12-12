import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure } from './backupStructure';
import prisma from '../../../../../../lib/prisma';
import { randomUUID } from 'crypto';
import { convertStringToUnit } from '../../../../../../lib/UnitConverter';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  console.log('Importing workspace', workspaceId);

  if (req.method === 'POST') {
    try {
      const data: BackupStructure = JSON.parse(await req.body);

      const garnishMapping: { id: string; newId: string }[] = [];
      if (data.garnish?.length > 0) {
        console.log('Importing garnishes', data.garnish?.length);
        data.garnish?.forEach((g) => {
          const garnishMappingItem = { id: g.id, newId: randomUUID() };
          g.id = garnishMappingItem.newId;
          g.workspaceId = workspaceId;
          garnishMapping.push(garnishMappingItem);
        });
        await prisma.garnish.createMany({ data: data.garnish, skipDuplicates: true });
      }

      const ingredientMapping: { id: string; newId: string }[] = [];
      if (data.ingredient?.length > 0) {
        console.log('Importing ingredients', data.ingredient?.length);
        data.ingredient?.forEach((g) => {
          const ingredientMappingItem = { id: g.id, newId: randomUUID() };
          g.id = ingredientMappingItem.newId;
          g.workspaceId = workspaceId;
          g.unit = convertStringToUnit(g.unit);
          ingredientMapping.push(ingredientMappingItem);
        });
        await prisma.ingredient.createMany({ data: data.ingredient, skipDuplicates: true });
      }
      const glassMapping: { id: string; newId: string }[] = [];
      if (data.glass?.length > 0) {
        console.log('Importing glasses', data.glass?.length);
        data.glass?.forEach((g) => {
          const glassMappingItem = { id: g.id, newId: randomUUID() };
          g.id = glassMappingItem.newId;
          g.workspaceId = workspaceId;
          glassMapping.push(glassMappingItem);
        });
        await prisma.glass.createMany({ data: data.glass, skipDuplicates: true });
      }

      const cocktailRecipeMapping: { id: string; newId: string }[] = [];
      if (data.cocktailRecipe?.length > 0) {
        console.log('Importing cocktailRecipes', data.cocktailRecipe?.length);
        data.cocktailRecipe?.forEach((g) => {
          const cocktailRecipeMappingItem = { id: g.id, newId: randomUUID() };
          g.id = cocktailRecipeMappingItem.newId;
          g.glassId = glassMapping.find((gm) => gm.id === g.glassId)?.newId!;
          g.workspaceId = workspaceId;
          cocktailRecipeMapping.push(cocktailRecipeMappingItem);
        });
        await prisma.cocktailRecipe.createMany({ data: data.cocktailRecipe, skipDuplicates: true });
      }
      const cocktailRecipeStepMapping: { id: string; newId: string }[] = [];
      if (data.cocktailRecipeStep?.length > 0) {
        console.log('Importing cocktailRecipeSteps', data.cocktailRecipeStep?.length);
        data.cocktailRecipeStep?.forEach((g) => {
          const cocktailRecipeStepMappingItem = { id: g.id, newId: randomUUID() };
          g.id = cocktailRecipeStepMappingItem.newId;
          g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)?.newId!;
          cocktailRecipeStepMapping.push(cocktailRecipeStepMappingItem);
        });
        await prisma.cocktailRecipeStep.createMany({ data: data.cocktailRecipeStep, skipDuplicates: true });
      }

      if (data.cocktailRecipeGarnish?.length > 0) {
        console.log('Importing cocktailRecipeGarnish', data.cocktailRecipeGarnish?.length);
        data.cocktailRecipeGarnish?.forEach((g) => {
          g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)?.newId!;
          g.garnishId = garnishMapping.find((gm) => gm.id === g.garnishId)?.newId!;
        });

        await prisma.cocktailRecipeGarnish.createMany({ data: data.cocktailRecipeGarnish, skipDuplicates: true });
      }
      if (data.cocktailRecipeIngredient?.length > 0) {
        console.log('Importing cocktailRecipeIngredient', data.cocktailRecipeIngredient?.length);
        data.cocktailRecipeIngredient.forEach((g) => {
          g.id = randomUUID();
          g.cocktailRecipeStepId = cocktailRecipeStepMapping.find((gm) => gm.id === g.cocktailRecipeStepId)?.newId!;
          g.ingredientId = ingredientMapping.find((gm) => gm.id === g.ingredientId)?.newId!;
          g.unit = convertStringToUnit(g.unit);
        });
        await prisma.cocktailRecipeIngredient.createMany({ data: data.cocktailRecipeIngredient, skipDuplicates: true });
      }

      const cocktailCardMapping: { id: string; newId: string }[] = [];
      if (data.cocktailCard?.length > 0) {
        console.log('Importing cocktailCard', data.cocktailCard?.length);
        data.cocktailCard?.forEach((g) => {
          const cocktailCardMappingItem = { id: g.id, newId: randomUUID() };
          g.id = cocktailCardMappingItem.newId;
          g.workspaceId = workspaceId;
          cocktailCardMapping.push(cocktailCardMappingItem);
        });
        await prisma.cocktailCard.createMany({ data: data.cocktailCard, skipDuplicates: true });
      }

      const cocktailCardGroupMapping: { id: string; newId: string }[] = [];
      if (data.cocktailCardGroup?.length > 0) {
        console.log('Importing cocktailCardGroup', data.cocktailCardGroup?.length);
        data.cocktailCardGroup?.forEach((g) => {
          const cocktailCardGroupMappingItem = { id: g.id, newId: randomUUID() };
          g.id = cocktailCardGroupMappingItem.newId;
          g.cocktailCardId = cocktailCardMapping.find((gm) => gm.id === g.cocktailCardId)?.newId!;
          cocktailCardGroupMapping.push(cocktailCardGroupMappingItem);
        });
        await prisma.cocktailCardGroup.createMany({ data: data.cocktailCardGroup, skipDuplicates: true });
      }

      if (data.cocktailCardGroupItem?.length > 0) {
        console.log('Importing cocktailCardGroupItem', data.cocktailCardGroupItem?.length);
        data.cocktailCardGroupItem?.forEach((g) => {
          g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)?.newId!;
          g.cocktailCardGroupId = cocktailCardGroupMapping.find((gm) => gm.id === g.cocktailCardGroupId)?.newId!;
        });
        await prisma.cocktailCardGroupItem.createMany({ data: data.cocktailCardGroupItem, skipDuplicates: true });
      }

      const cocktailCalculationMapping: { id: string; newId: string }[] = [];
      if (data.calculation?.length > 0) {
        console.log('Importing cocktailCardGroupItem', data.calculation?.length);
        data.calculation?.forEach((g) => {
          const cocktailCalculationMappingItem = { id: g.id, newId: randomUUID() };
          g.id = cocktailCalculationMappingItem.newId;
          g.workspaceId = workspaceId;
          cocktailCalculationMapping.push(cocktailCalculationMappingItem);
        });
        await prisma.cocktailCalculation.createMany({ data: data.calculation, skipDuplicates: true });
      }

      if (data.calculationItems?.length > 0) {
        console.log('Importing cocktailCardGroupItem', data.cocktailCardGroupItem?.length);
        data.calculationItems?.forEach((g) => {
          g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)?.newId!;
          g.calculationId = cocktailCalculationMapping.find((gm) => gm.id === g.calculationId)?.newId!;
        });
        await prisma.cocktailCalculationItems.createMany({ data: data.calculationItems, skipDuplicates: true });
      }

      console.log('Import finished');
      return res.status(200).json({ msg: 'Success' });
    } catch (e) {
      console.log(e);
      return res.status(500).json({ msg: 'Error' });
    }
  }
}
