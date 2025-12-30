import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../prisma/prisma';
import { $Enums, Role } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { regenerateUnitConversions } from '../workspaces/[workspaceId]/units/conversions';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

interface DemoConfig {
  workspace: {
    name: string;
    description?: string;
  };
  glasses: Array<{
    name: string;
    volume?: number;
    deposit: number;
    notes?: string;
  }>;
  ingredients: Array<{
    name: string;
    shortName?: string;
    description?: string;
    price?: number;
    tags?: string[];
  }>;
  garnishes: Array<{
    name: string;
    description?: string;
    price?: number;
  }>;
  cocktails: Array<{
    name: string;
    description?: string;
    tags?: string[];
    price?: number;
    iceName: string;
    glassName: string;
    garnishes?: Array<{
      garnishName: string;
      garnishNumber: number;
      description?: string;
      optional?: boolean;
    }>;
    steps: Array<{
      stepNumber: number;
      actionName: string;
      actionGroup: string;
      optional?: boolean;
      ingredients: Array<{
        ingredientNumber: number;
        ingredientName: string;
        amount?: number;
        unitName?: string;
        optional?: boolean;
      }>;
    }>;
  }>;
}

export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    // Check if demo mode is enabled
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ message: 'Demo mode is not enabled' });
    }

    try {
      // Load demo configuration
      const configPath = process.env.DEMO_WORKSPACE_CONFIG_PATH || join(process.cwd(), 'config', 'demo-workspace-config.json');
      const configFile = readFileSync(configPath, 'utf-8');
      const config: DemoConfig = JSON.parse(configFile);

      // Calculate expiration time
      const ttlHours = parseInt(process.env.DEMO_TTL_HOURS || '24', 10);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      // Create demo user (without email)
      const demoUserId = randomUUID();
      const demoUser = await prisma.user.create({
        data: {
          id: demoUserId,
          name: 'Demo Nutzer',
          email: null, // No email for demo users
        },
      });

      // Create unit IDs for conversions
      const grammId = randomUUID();
      const clId = randomUUID();
      const spoonId = randomUUID();
      const sprayId = randomUUID();
      const dropperDropId = randomUUID();
      const dropperCmId = randomUUID();
      const dashId = randomUUID();

      // Create workspace with standard data
      const workspace = await prisma.workspace.create({
        data: {
          name: config.workspace.name,
          description: config.workspace.description || null,
          isDemo: true,
          expiresAt: expiresAt,
          demoUserId: demoUserId,
          users: {
            create: {
              userId: demoUserId,
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

      // Get ice types for reference
      const iceTypes = await prisma.ice.findMany({
        where: { workspaceId: workspace.id },
      });

      // Get units for reference
      const units = await prisma.unit.findMany({
        where: { workspaceId: workspace.id },
      });

      // Get actions for reference
      const actions = await prisma.workspaceCocktailRecipeStepAction.findMany({
        where: { workspaceId: workspace.id },
      });

      // Create glasses
      const glassMap = new Map<string, string>();
      for (const glassConfig of config.glasses) {
        const glass = await prisma.glass.create({
          data: {
            id: randomUUID(),
            name: glassConfig.name,
            volume: glassConfig.volume || null,
            deposit: glassConfig.deposit,
            notes: glassConfig.notes || null,
            workspaceId: workspace.id,
          },
        });
        glassMap.set(glassConfig.name, glass.id);
      }

      // Create ingredients
      const ingredientMap = new Map<string, string>();
      for (const ingredientConfig of config.ingredients) {
        const ingredient = await prisma.ingredient.create({
          data: {
            id: randomUUID(),
            name: ingredientConfig.name,
            shortName: ingredientConfig.shortName || null,
            description: ingredientConfig.description || null,
            price: ingredientConfig.price || null,
            tags: ingredientConfig.tags || [],
            workspaceId: workspace.id,
          },
        });
        ingredientMap.set(ingredientConfig.name, ingredient.id);
      }

      // Create garnishes
      const garnishMap = new Map<string, string>();
      for (const garnishConfig of config.garnishes) {
        const garnish = await prisma.garnish.create({
          data: {
            id: randomUUID(),
            name: garnishConfig.name,
            description: garnishConfig.description || null,
            price: garnishConfig.price || null,
            workspaceId: workspace.id,
          },
        });
        garnishMap.set(garnishConfig.name, garnish.id);
      }

      // Create cocktails
      for (const cocktailConfig of config.cocktails) {
        // Find ice type
        const iceType = iceTypes.find((ice) => ice.name === cocktailConfig.iceName);
        if (!iceType) {
          console.error(`Ice type not found: ${cocktailConfig.iceName}`);
          continue;
        }

        // Find glass
        const glassId = glassMap.get(cocktailConfig.glassName);
        if (!glassId) {
          console.error(`Glass not found: ${cocktailConfig.glassName}`);
          continue;
        }

        // Create cocktail
        const cocktail = await prisma.cocktailRecipe.create({
          data: {
            id: randomUUID(),
            name: cocktailConfig.name,
            description: cocktailConfig.description || null,
            tags: cocktailConfig.tags || [],
            price: cocktailConfig.price || null,
            iceId: iceType.id,
            glassId: glassId,
            workspaceId: workspace.id,
            isArchived: false,
          },
        });

        // Create garnishes for cocktail
        if (cocktailConfig.garnishes) {
          for (const garnishConfig of cocktailConfig.garnishes) {
            const garnishId = garnishMap.get(garnishConfig.garnishName);
            if (garnishId) {
              await prisma.cocktailRecipeGarnish.create({
                data: {
                  cocktailRecipeId: cocktail.id,
                  garnishId: garnishId,
                  description: garnishConfig.description || null,
                  garnishNumber: garnishConfig.garnishNumber,
                  optional: garnishConfig.optional || false,
                },
              });
            }
          }
        }

        // Create steps for cocktail
        for (const stepConfig of cocktailConfig.steps) {
          // Find action
          const action = actions.find((a) => a.name === stepConfig.actionName && a.actionGroup === stepConfig.actionGroup);
          if (!action) {
            console.error(`Action not found: ${stepConfig.actionName} (${stepConfig.actionGroup})`);
            continue;
          }

          // Create step
          const step = await prisma.cocktailRecipeStep.create({
            data: {
              id: randomUUID(),
              stepNumber: stepConfig.stepNumber,
              optional: stepConfig.optional || false,
              actionId: action.id,
              cocktailRecipeId: cocktail.id,
            },
          });

          // Create ingredients for step
          for (const ingredientConfig of stepConfig.ingredients) {
            const ingredientId = ingredientMap.get(ingredientConfig.ingredientName);
            if (!ingredientId) {
              console.error(`Ingredient not found: ${ingredientConfig.ingredientName}`);
              continue;
            }

            // Find unit
            let unitId: string | null = null;
            if (ingredientConfig.unitName) {
              const unit = units.find((u) => u.name === ingredientConfig.unitName);
              if (unit) {
                unitId = unit.id;
              }
            }

            await prisma.cocktailRecipeIngredient.create({
              data: {
                id: randomUUID(),
                ingredientNumber: ingredientConfig.ingredientNumber,
                optional: ingredientConfig.optional || false,
                amount: ingredientConfig.amount || null,
                unitId: unitId,
                ingredientId: ingredientId,
                cocktailRecipeStepId: step.id,
              },
            });
          }
        }
      }

      // Regenerate unit conversions
      await regenerateUnitConversions(workspace.id);

      return res.json({
        data: {
          workspaceId: workspace.id,
          userId: demoUserId,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Error creating demo workspace:', error);
      return res.status(500).json({ message: 'Error creating demo workspace', error: String(error) });
    }
  },
});
