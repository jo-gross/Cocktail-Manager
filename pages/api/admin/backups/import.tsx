import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure } from './backupStructure';
import prisma from '../../../../lib/prisma';
import { Protocol } from 'playwright-core/types/protocol';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const data: BackupStructure = JSON.parse(req.body);

      await Promise.all([
        prisma.garnish.createMany({ data: data.garnish, skipDuplicates: true }),
        prisma.ingredient.createMany({ data: data.ingredient, skipDuplicates: true }),
        prisma.glass.createMany({ data: data.glass, skipDuplicates: true }),
        prisma.cocktailRecipe.createMany({ data: data.cocktailRecipe, skipDuplicates: true }),
        prisma.cocktailRecipeStep.createMany({ data: data.cocktailRecipeStep, skipDuplicates: true }),
        prisma.cocktailRecipeGarnish.createMany({ data: data.cocktailRecipeGarnish, skipDuplicates: true }),
        prisma.cocktailRecipeIngredient.createMany({ data: data.cocktailRecipeIngredient, skipDuplicates: true }),
        prisma.cocktailCard.createMany({ data: data.cocktailCard, skipDuplicates: true }),
        prisma.cocktailCardGroup.createMany({ data: data.cocktailCardGroup, skipDuplicates: true }),
        prisma.cocktailCardGroupItem.createMany({ data: data.cocktailCardGroupItem, skipDuplicates: true }),
      ]);

      return res.status(200).json({ msg: 'Success' });
    } catch (e) {
      console.log(e);
      return res.status(500).json({ msg: 'Error' });
    }
  }
}
