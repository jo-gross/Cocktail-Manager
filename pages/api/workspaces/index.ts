import prisma from '../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { $Enums, Role, User } from '@prisma/client';
import { withAuthentication } from '../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../middleware/api/handleMethods';
import { randomUUID } from 'crypto';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const { name } = req.body;
    const result = await prisma.workspace.create({
      data: {
        name: name,
        users: {
          create: {
            userId: user.id,
            role: Role.OWNER,
          },
        },
        WorkspaceCocktailRecipeStepAction: {
          createMany: {
            data: [
              {
                id: randomUUID(),
                name: 'SHAKE',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'STIR',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'FLOAT',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'BUILD_IN_GLASS',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'BLENDER',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'MUDDLE',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'FOAM',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'SINGLE_STRAIN',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'DOUBLE_STRAIN',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'WITHOUT',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'DIRTY_ICE',
                actionGroup: 'POURING',
              },
            ],
          },
        },
        WorkspaceSetting: {
          create: {
            setting: WorkspaceSettingKey.translations,
            value: JSON.stringify({
              de: {
                SHAKE: 'Shaken',
                STIR: 'Rühren',
                FLOAT: 'Floaten',
                BUILD_IN_GLASS: 'Im Glas bauen',
                BLENDER: 'Im Blender',
                MUDDLE: 'Muddlen',
                FOAM: 'Aufschäumen',
                SINGLE_STRAIN: 'Single Strain',
                DOUBLE_STRAIN: 'Double Strain',
                WITHOUT: 'Einschenken',
                DIRTY_ICE: 'Dirty Ice',
                POURING: 'Einschenken',
                MIXING: 'Mixen',
              },
            }),
          },
        },
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const result = await prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    return res.json({ data: result });
  }),
});
