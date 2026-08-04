// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { CocktailRating, Prisma, Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withDeprecation } from '@middleware/api/withDeprecation';
import prisma from '../../../../../../../prisma/prisma';
import CocktailRatingCreateInput = Prisma.CocktailRatingCreateInput;

const legacyHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.RATINGS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, _workspace) => {
    const { cocktailId } = req.query;
    const cocktailRecipes: CocktailRating[] = await prisma.cocktailRating.findMany({
      where: {
        cocktailId: cocktailId as string,
      },
    });

    return res.json({ data: cocktailRecipes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.RATINGS_CREATE, async (req: NextApiRequest, res: NextApiResponse, _user, _workspace) => {
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

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings' }, legacyHandler);
