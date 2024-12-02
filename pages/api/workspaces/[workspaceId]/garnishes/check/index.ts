import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Garnish, Role, Workspace } from '@prisma/client';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { calculateGarnishSimilarity } from '../../../../../../lib/findSimilarEntities';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const { name } = req.query;
        if (typeof name !== 'string') {
          return res.status(400).json({ msg: 'Invalid query' });
        }
        if (name.length < 3) {
          return res.status(200).json({ data: null });
        }

        const allGarnishes = await transaction.garnish.findMany({
          where: {
            workspaceId: workspace.id,
          },
        });

        let similarGarnish: Garnish | undefined = undefined;
        let maxSimilarity = 0;

        for (const garnish of allGarnishes) {
          const similarity = calculateGarnishSimilarity(name, garnish);

          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            similarGarnish = garnish;
          }
        }

        if (maxSimilarity > 0.5) {
          // Ähnlichkeitsschwelle anpassen
          return res.status(200).json({ data: similarGarnish });
        } else {
          return res.status(200).json({ data: null });
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
