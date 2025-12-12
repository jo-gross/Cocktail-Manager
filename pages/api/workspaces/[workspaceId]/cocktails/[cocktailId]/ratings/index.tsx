// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { CocktailRating, Prisma, Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import prisma from '../../../../../../../prisma/prisma';
import CocktailRatingCreateInput = Prisma.CocktailRatingCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.RATINGS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId } = req.query;
    const cocktailRecipes: CocktailRating[] = await prisma.cocktailRating.findMany({
      where: {
        cocktailId: cocktailId as string,
      },
    });

    return res.json({ data: cocktailRecipes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.RATINGS_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, rating, comment } = req.body;
    const { cocktailId } = req.query;

    const input: CocktailRatingCreateInput = {
      name: name,
      rating: rating,
      comment: comment,
      cocktail: { connect: { id: cocktailId as string } },
    };

    const result = await prisma.cocktailRating.create({
      data: input,
    });

    return res.json({ data: result });
  }),
});
