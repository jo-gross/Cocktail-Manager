import prisma from '../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { $Enums, Role, User } from '@generated/prisma/client';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { randomUUID } from 'crypto';
import { regenerateUnitConversions } from './[workspaceId]/units/conversions';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    if (process.env.DISABLE_WORKSPACE_CREATION === 'true') {
      return res.status(403).json({ message: 'Workspace-Erstellung ist deaktiviert' });
    }

    const { name } = req.body;

    const grammId = randomUUID();
    const clId = randomUUID();
    const spoonId = randomUUID();
    const sprayId = randomUUID();
    const dropperDropId = randomUUID();
    const dropperCmId = randomUUID();
    const dashId = randomUUID();

    const result = await prisma.workspace.create({
      data: {
        name: name,
        users: {
          create: {
            userId: user.id,
            role: Role.OWNER,
          },
        },
        Ice: {
          createMany: {
            data: [
              {
                id: randomUUID(),
                name: 'ICE_CRUSHED',
              },
              {
                id: randomUUID(),
                name: 'ICE_CUBES',
              },
              {
                id: randomUUID(),
                name: 'WITHOUT_ICE',
              },
            ],
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
        Unit: {
          createMany: {
            data: [
              {
                id: clId,
                name: 'CL',
              },
              {
                id: randomUUID(),
                name: 'PIECE',
              },
              {
                id: grammId,
                name: 'GRAMM',
              },
              {
                id: dropperDropId,
                name: 'DROPPER_DROP',
              },
              {
                id: dropperCmId,
                name: 'DROPPER_CM',
              },
              {
                id: dashId,
                name: 'DASH',
              },
              {
                id: spoonId,
                name: 'BAR_SPOON',
              },
              {
                id: sprayId,
                name: 'SPRAY',
              },
            ],
          },
        },
        UnitConversion: {
          createMany: {
            data: [
              {
                id: randomUUID(),
                fromUnitId: grammId,
                toUnitId: sprayId,
                factor: 10,
              },
              {
                id: randomUUID(),
                fromUnitId: clId,
                toUnitId: grammId,
                factor: 10,
              },
              {
                id: randomUUID(),
                fromUnitId: clId,
                toUnitId: spoonId,
                factor: 2,
              },
              {
                id: randomUUID(),
                fromUnitId: grammId,
                toUnitId: dashId,
                factor: 1,
              },
              {
                id: randomUUID(),
                fromUnitId: grammId,
                toUnitId: dropperCmId,
                factor: 6,
              },
              {
                id: randomUUID(),
                fromUnitId: grammId,
                toUnitId: dropperDropId,
                factor: 50,
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
                CL: 'cl',
                PIECE: 'Stück',
                GRAMM: 'Gramm',
                DROPPER_DROP: 'Pip. Tropfen',
                DROPPER_CM: 'Pip. cm',
                DASH: 'Dash',
                BAR_SPOON: 'Barlöffel',
                SPRAY: 'Sprüher',
                ICE_CUBES: 'Würfel',
                ICE_CRUSHED: 'Crushed',
                WITHOUT_ICE: 'Ohne Eis',
              },
            }),
          },
        },
      },
    });

    await regenerateUnitConversions(result.id);

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
      include: {
        users: true,
      },
    });

    const sortedResult = result.sort(
      (a, b) =>
        (b.users?.find((u) => u.userId == user.id)?.lastOpened || new Date(1970, 1, 1)).getTime() -
        (a.users?.find((u) => u.userId == user.id)?.lastOpened || new Date(1970, 1, 1)).getTime(),
    );

    return res.json({ data: sortedResult });
  }),
});
