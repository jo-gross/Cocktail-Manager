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
                displayName: 'Shake',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'STIR',
                displayName: 'Rühren',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'FLOAT',
                displayName: 'Floaten',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'BUILD_IN_GLASS',
                displayName: 'Im Glas bauen',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'BLENDER',
                displayName: 'Blenden',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'MUDDLE',
                displayName: 'Muddeln',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'FOAM',
                displayName: 'Aufschäumen',
                actionGroup: 'MIXING',
              },
              {
                id: randomUUID(),
                name: 'SINGLE_STRAIN',
                displayName: 'Single Strain',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'DOUBLE_STRAIN',
                displayName: 'Double Strain',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'WITHOUT',
                displayName: 'Einschenken',
                actionGroup: 'POURING',
              },
              {
                id: randomUUID(),
                name: 'DIRTY_ICE',
                displayName: 'Dirty Ice',
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
                WITHOUT: 'Einschänken',
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
