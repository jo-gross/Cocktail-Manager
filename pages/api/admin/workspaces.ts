import { NextApiRequest, NextApiResponse } from 'next';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import prisma from '../../../prisma/prisma';
import { constants as HttpStatus } from 'http2';
import { $Enums, Role } from '@generated/prisma/client';
import { randomUUID } from 'crypto';
import { regenerateUnitConversions } from '../workspaces/[workspaceId]/units/conversions';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    // Check master API key
    if (!checkMasterApiKey(req)) {
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'API key required' });
    }

    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'Workspace name is required' });
    }

    try {
      const grammId = randomUUID();
      const clId = randomUUID();
      const spoonId = randomUUID();
      const sprayId = randomUUID();
      const dropperDropId = randomUUID();
      const dropperCmId = randomUUID();
      const dashId = randomUUID();

      // Generate unique join code
      let joinCode: string;
      let codeExists = true;
      while (codeExists) {
        joinCode = Math.random().toString(36).slice(2, 8).toLowerCase();
        const existing = await prisma.workspaceJoinCode.findUnique({
          where: { code: joinCode },
        });
        codeExists = !!existing;
      }

      const workspace = await prisma.workspace.create({
        data: {
          name: name,
          // No users created - workspace is empty
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
          // Create join code
          WorkspaceJoinCode: {
            create: {
              code: joinCode!,
              expires: null,
              onlyUseOnce: false,
            },
          },
        },
      });

      await regenerateUnitConversions(workspace.id);

      return res.json({
        data: {
          workspace: {
            id: workspace.id,
            name: workspace.name,
          },
          joinCode: joinCode!,
        },
      });
    } catch (error) {
      console.error('Error creating workspace:', error);
      return res.status(HttpStatus.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ message: 'Failed to create workspace' });
    }
  },
});

