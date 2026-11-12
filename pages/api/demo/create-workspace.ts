import { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { regenerateUnitConversions } from '@lib/api/controllers/units';
import { BULK_TX_TIMEOUT_MS, runTx } from '@lib/db/tx';
import { applyRateLimit, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { sendFail } from '@lib/http/responses';
import { createDemoLoginToken } from '@lib/demo/loginToken';
import { createWorkspaceWithDefaults } from '@lib/workspace/createWorkspaceWithDefaults';

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
    image?: string;
  }>;
  ingredients: Array<{
    name: string;
    shortName?: string;
    description?: string;
    price?: number;
    tags?: string[];
    image?: string;
    /** Mengeneinheit (z. B. CL, PIECE, DASH) – muss zu einem Workspace-Unit passen. Fallback: CL */
    unitName?: string;
    /** Menge pro Einheit (z. B. 70 für 70 cl pro Flasche). Fallback: 70 */
    volume?: number;
  }>;
  garnishes: Array<{
    name: string;
    description?: string;
    price?: number;
    image?: string;
  }>;
  cocktails: Array<{
    name: string;
    description?: string;
    tags?: string[];
    price?: number;
    iceName: string;
    glassName: string;
    image?: string;
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

/** Public and unauthenticated: a few demo workspaces per client IP and hour. */
const createDemoLimiter = new TokenBucketRateLimiter({ capacity: 5, refillPerSecond: 5 / 3600 });

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Reads a raster image file and converts it to a base64 data URL string
 * @param imagePath - Path to the image file (relative to config directory or absolute)
 * @param configDir - Directory where the config file is located
 * @returns Base64 data URL string or null if file doesn't exist or isn't a raster image
 */
function readImageAsBase64(imagePath: string, configDir: string): string | null {
  try {
    // Resolve path: if absolute (starts with /), use as-is; otherwise resolve relative to config directory
    const resolvedPath = imagePath.startsWith('/') ? imagePath : join(configDir, imagePath);
    const mimeType = IMAGE_MIME_TYPES[extname(resolvedPath).toLowerCase()];
    if (!mimeType) {
      console.warn(`Unsupported demo image type (raster images only): ${resolvedPath}`);
      return null;
    }
    if (!existsSync(resolvedPath)) {
      console.warn(`Image file not found: ${resolvedPath}`);
      return null;
    }
    return `data:${mimeType};base64,${readFileSync(resolvedPath).toString('base64')}`;
  } catch (error) {
    console.error(`Error reading image file ${imagePath}:`, error);
    return null;
  }
}

function loadDemoConfig(): { config: DemoConfig; images: Map<string, string | null> } {
  const configPath = process.env.DEMO_WORKSPACE_CONFIG_PATH || join(process.cwd(), 'config', 'demo-workspace-config.json');
  const config: DemoConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  const configDir = dirname(configPath);
  // File access happens before the transaction.
  const images = new Map<string, string | null>();
  for (const entry of [...config.glasses, ...config.ingredients, ...config.garnishes, ...config.cocktails]) {
    if (entry.image && !images.has(entry.image)) images.set(entry.image, readImageAsBase64(entry.image, configDir));
  }
  return { config, images };
}

/**
 * Creates a demo user and a seeded demo workspace (one transaction) and returns a
 * short-lived `loginToken` for `/api/auth/demo-login`.
 */
export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    if (process.env.DEMO_MODE !== 'true') {
      return sendFail(res, 403, 'DEMO_DISABLED', 'Demo mode is not enabled');
    }
    if (!applyRateLimit(createDemoLimiter, req, res, 'demo-create')) return;

    let demoConfig: ReturnType<typeof loadDemoConfig>;
    try {
      demoConfig = loadDemoConfig();
    } catch (error) {
      console.error('Error loading demo workspace config:', error);
      return sendFail(res, 500, 'DEMO_CONFIG_ERROR', 'Error creating demo workspace');
    }
    const { config, images } = demoConfig;

    const ttlHours = parseInt(process.env.DEMO_TTL_HOURS || '24', 10);
    const expiresAt = new Date(Date.now() + (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) * 60 * 60 * 1000);
    const demoUserId = randomUUID();

    const workspaceId = await runTx(
      async (tx) => {
        // Demo user without e-mail; it can only log in via a demo login token.
        await tx.user.create({ data: { id: demoUserId, name: 'Demo Nutzer', email: null } });

        const workspace = await createWorkspaceWithDefaults(
          {
            name: config.workspace.name,
            description: config.workspace.description || null,
            userId: demoUserId,
            role: Role.OWNER,
            demo: { demoUserId, expiresAt },
          },
          tx,
        );

        const iceTypes = await tx.ice.findMany({ where: { workspaceId: workspace.id } });
        const units = await tx.unit.findMany({ where: { workspaceId: workspace.id } });
        const actions = await tx.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId: workspace.id } });

        const glassMap = new Map<string, string>();
        for (const glassConfig of config.glasses) {
          const glass = await tx.glass.create({
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
          const image = glassConfig.image ? images.get(glassConfig.image) : null;
          if (image) await tx.glassImage.create({ data: { image, glassId: glass.id } });
        }

        const ingredientMap = new Map<string, string>();
        for (const ingredientConfig of config.ingredients) {
          const ingredient = await tx.ingredient.create({
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

          // Mengeneinheit: IngredientVolume anlegen (realistische Mengenangabe pro Einheit)
          const unit = units.find((u) => u.name === (ingredientConfig.unitName ?? 'CL'));
          if (unit) {
            await tx.ingredientVolume.create({
              data: { id: randomUUID(), ingredientId: ingredient.id, unitId: unit.id, workspaceId: workspace.id, volume: ingredientConfig.volume ?? 70 },
            });
          }
          const image = ingredientConfig.image ? images.get(ingredientConfig.image) : null;
          if (image) await tx.ingredientImage.create({ data: { image, ingredientId: ingredient.id } });
        }

        const garnishMap = new Map<string, string>();
        for (const garnishConfig of config.garnishes) {
          const garnish = await tx.garnish.create({
            data: {
              id: randomUUID(),
              name: garnishConfig.name,
              description: garnishConfig.description || null,
              price: garnishConfig.price || null,
              workspaceId: workspace.id,
            },
          });
          garnishMap.set(garnishConfig.name, garnish.id);
          const image = garnishConfig.image ? images.get(garnishConfig.image) : null;
          if (image) await tx.garnishImage.create({ data: { image, garnishId: garnish.id } });
        }

        for (const cocktailConfig of config.cocktails) {
          const iceType = iceTypes.find((ice) => ice.name === cocktailConfig.iceName);
          const glassId = glassMap.get(cocktailConfig.glassName);
          if (!iceType || !glassId) {
            console.error(`Demo cocktail "${cocktailConfig.name}" skipped: unknown ice "${cocktailConfig.iceName}" or glass "${cocktailConfig.glassName}"`);
            continue;
          }

          const cocktail = await tx.cocktailRecipe.create({
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
          const image = cocktailConfig.image ? images.get(cocktailConfig.image) : null;
          if (image) await tx.cocktailRecipeImage.create({ data: { image, cocktailRecipeId: cocktail.id } });

          for (const garnishConfig of cocktailConfig.garnishes ?? []) {
            const garnishId = garnishMap.get(garnishConfig.garnishName);
            if (!garnishId) continue;
            await tx.cocktailRecipeGarnish.create({
              data: {
                cocktailRecipeId: cocktail.id,
                garnishId: garnishId,
                description: garnishConfig.description || null,
                garnishNumber: garnishConfig.garnishNumber,
                optional: garnishConfig.optional || false,
              },
            });
          }

          for (const stepConfig of cocktailConfig.steps) {
            const action = actions.find((a) => a.name === stepConfig.actionName && a.actionGroup === stepConfig.actionGroup);
            if (!action) {
              console.error(`Action not found: ${stepConfig.actionName} (${stepConfig.actionGroup})`);
              continue;
            }

            const step = await tx.cocktailRecipeStep.create({
              data: {
                id: randomUUID(),
                stepNumber: stepConfig.stepNumber,
                optional: stepConfig.optional || false,
                actionId: action.id,
                cocktailRecipeId: cocktail.id,
              },
            });

            for (const ingredientConfig of stepConfig.ingredients) {
              const ingredientId = ingredientMap.get(ingredientConfig.ingredientName);
              if (!ingredientId) {
                console.error(`Ingredient not found: ${ingredientConfig.ingredientName}`);
                continue;
              }
              const unitId = ingredientConfig.unitName ? (units.find((u) => u.name === ingredientConfig.unitName)?.id ?? null) : null;
              await tx.cocktailRecipeIngredient.create({
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

        return workspace.id;
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );

    // Opens its own transaction; derived data, the workspace is usable without it.
    try {
      await regenerateUnitConversions(workspaceId);
    } catch (error) {
      console.error(`[DemoWorkspace][${workspaceId}] Regenerating unit conversions failed:`, error);
    }

    return res.json({
      data: {
        workspaceId,
        userId: demoUserId,
        expiresAt: expiresAt.toISOString(),
        loginToken: createDemoLoginToken(demoUserId),
      },
    });
  },
});
