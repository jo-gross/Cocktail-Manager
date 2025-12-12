import prisma from '../../prisma/prisma';
import { $Enums, Prisma, Role } from '@generated/prisma/client';
import { randomUUID } from 'crypto';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

interface CreateWorkspaceOptions {
  name: string;
  userId?: string;
  role?: Role;
  joinCode?: string;
}

/**
 * Creates a workspace with all default data (Ice, Actions, Units, Conversions, Settings)
 * Optionally creates a user and/or join code
 */
export async function createWorkspaceWithDefaults(options: CreateWorkspaceOptions) {
  const { name, userId, role, joinCode } = options;

  const grammId = randomUUID();
  const clId = randomUUID();
  const spoonId = randomUUID();
  const sprayId = randomUUID();
  const dropperDropId = randomUUID();
  const dropperCmId = randomUUID();
  const dashId = randomUUID();

  const workspaceData: Prisma.WorkspaceCreateInput = {
    name: name,
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
  };

  // Add user if provided
  if (userId && role) {
    workspaceData.users = {
      create: {
        userId: userId,
        role: role,
      },
    };
  }

  // Add join code if provided
  if (joinCode) {
    workspaceData.WorkspaceJoinCode = {
      create: {
        code: joinCode,
        expires: null,
        onlyUseOnce: false,
      },
    };
  }

  return await prisma.workspace.create({
    data: workspaceData,
  });
}
