import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure } from './backupStructure';
import prisma from '../../../../../../lib/prisma';

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

      data.garnish?.forEach((g) => {
        g.workspaceId = workspaceId;
      });
      data.ingredient?.forEach((g) => {
        g.workspaceId = workspaceId;
      });
      data.glass?.forEach((g) => {
        g.workspaceId = workspaceId;
      });
      data.cocktailRecipe?.forEach((g) => {
        g.workspaceId = workspaceId;
      });
      data.cocktailCard?.forEach((g) => {
        g.workspaceId = workspaceId;
      });

      console.log('Importing garnishes', data.garnish?.length);
      if (data.garnish?.length > 0) await prisma.garnish.createMany({ data: data.garnish, skipDuplicates: true });

      console.log('Importing ingredients', data.ingredient?.length);
      if (data.ingredient?.length > 0)
        await prisma.ingredient.createMany({ data: data.ingredient, skipDuplicates: true });
      console.log('Importing glasses', data.glass?.length);
      if (data.glass?.length > 0) await prisma.glass.createMany({ data: data.glass, skipDuplicates: true });

      console.log('Importing cocktailRecipes', data.cocktailRecipe?.length);
      if (data.cocktailRecipe?.length > 0)
        await prisma.cocktailRecipe.createMany({ data: data.cocktailRecipe, skipDuplicates: true });
      console.log('Importing cocktailRecipeSteps', data.cocktailRecipeStep?.length);
      if (data.cocktailRecipeStep?.length > 0)
        await prisma.cocktailRecipeStep.createMany({ data: data.cocktailRecipeStep, skipDuplicates: true });
      console.log('Importing cocktailRecipeGarnish', data.cocktailRecipeGarnish?.length);
      if (data.cocktailRecipeGarnish?.length > 0)
        await prisma.cocktailRecipeGarnish.createMany({ data: data.cocktailRecipeGarnish, skipDuplicates: true });
      console.log('Importing cocktailRecipeIngredient', data.cocktailRecipeIngredient?.length);
      if (data.cocktailRecipeIngredient?.length > 0)
        await prisma.cocktailRecipeIngredient.createMany({ data: data.cocktailRecipeIngredient, skipDuplicates: true });

      console.log('Importing cocktailCard', data.cocktailCard?.length);
      if (data.cocktailCard?.length > 0)
        await prisma.cocktailCard.createMany({ data: data.cocktailCard, skipDuplicates: true });
      if (data.cocktailCardGroup?.length > 0)
        console.log('Importing cocktailCardGroup', data.cocktailCardGroup?.length);
      if (data.cocktailCardGroup?.length > 0)
        await prisma.cocktailCardGroup.createMany({ data: data.cocktailCardGroup, skipDuplicates: true });
      console.log('Importing cocktailCardGroupItem', data.cocktailCardGroupItem?.length);
      if (data.cocktailCardGroupItem?.length > 0)
        await prisma.cocktailCardGroupItem.createMany({ data: data.cocktailCardGroupItem, skipDuplicates: true });
      console.log('Import finished');
      return res.status(200).json({ msg: 'Success' });
    } catch (e) {
      console.log(e);
      return res.status(500).json({ msg: 'Error' });
    }
  }
}
