import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../lib/prisma';
import { BackupStructure } from './backupStructure';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const backup: BackupStructure = {
      garnish: await prisma.garnish.findMany(),
      ingredient: await prisma.ingredient.findMany(),
      glass: await prisma.glass.findMany(),
      cocktailRecipe: await prisma.cocktailRecipe.findMany(),
      cocktailRecipeStep: await prisma.cocktailRecipeStep.findMany(),
      cocktailRecipeGarnish: await prisma.cocktailRecipeGarnish.findMany(),
      cocktailRecipeIngredient: await prisma.cocktailRecipeIngredient.findMany(),
      cocktailCard: await prisma.cocktailCard.findMany(),
      cocktailCardGroup: await prisma.cocktailCardGroup.findMany(),
      cocktailCardGroupItem: await prisma.cocktailCardGroupItem.findMany(),
    };

    return res.json(backup);
  }
  return res.status(405).json({ msg: 'Method not implemented' });
}
