import prisma from '../../../../../../prisma/prisma';
import { createCocktailRecipeAuditLog } from '../../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { CocktailRecipeStepFull } from '../../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../../models/CocktailRecipeGarnishFull';
import { CocktailRecipeFullWithImage } from '../../../../../../models/CocktailRecipeFullWithImage';
import { CocktailRecipeFull } from '../../../../../../models/CocktailRecipeFull';
import CocktailRecipeUpdateInput = Prisma.CocktailRecipeUpdateInput;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.COCKTAILS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const { include } = req.query;
    if (include == 'image' || include?.includes('image')) {
      const result: CocktailRecipeFullWithImage | null = await prisma.cocktailRecipe.findFirst({
        where: {
          id: cocktailId,
          workspaceId: workspace.id,
        },
        include: {
          _count: { select: { CocktailRecipeImage: true } },
          ice: true,
          glass: { include: { _count: { select: { GlassImage: true } } } },
          CocktailRecipeImage: {
            select: {
              image: true,
            },
          },
          garnishes: {
            include: {
              garnish: { include: { _count: { select: { GarnishImage: true } } } },
            },
          },
          steps: {
            include: {
              action: true,
              ingredients: {
                include: {
                  ingredient: { include: { _count: { select: { IngredientImage: true } } } },
                  unit: true,
                },
              },
            },
          },
          ratings: true,
        },
      });
      return res.json({ data: result });
    } else {
      const result: CocktailRecipeFull | null = await prisma.cocktailRecipe.findFirst({
        where: {
          id: cocktailId,
          workspaceId: workspace.id,
        },
        include: {
          _count: { select: { CocktailRecipeImage: true } },
          ice: true,
          glass: { include: { _count: { select: { GlassImage: true } } } },
          garnishes: {
            include: {
              garnish: { include: { _count: { select: { GarnishImage: true } } } },
            },
          },
          steps: {
            include: {
              action: true,
              ingredients: {
                include: {
                  ingredient: {
                    include: { _count: { select: { IngredientImage: true } } },
                  },
                  unit: true,
                },
              },
            },
          },
          ratings: true,
        },
      });
      return res.json({ data: result });
    }
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.COCKTAILS_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const { name, description, tags, price, iceId, image, glassId, garnishes = [], steps = [], notes, history } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const oldCocktail = await tx.cocktailRecipe.findUnique({
        where: { id: cocktailId },
        include: {
          ice: true,
          glass: true,
          garnishes: { include: { garnish: true } },
          steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
          CocktailRecipeImage: true,
        },
      });

      const input: CocktailRecipeUpdateInput = {
        name: name,
        description: description,
        notes: notes,
        history: history,
        tags: tags,
        price: price,
        ice: { connect: { id: iceId } },
        glass: { connect: { id: glassId } },
        workspace: { connect: { id: workspace.id } },
      };

      // Basisdaten des Cocktails aktualisieren
      const updatedCocktail = await tx.cocktailRecipe.update({
        where: {
          id: cocktailId,
        },
        data: input,
      });

      // Bild-Handling beibehalten (max. ein Bild)
      await tx.cocktailRecipeImage.deleteMany({
        where: {
          cocktailRecipeId: cocktailId,
        },
      });

      if (image != undefined) {
        await tx.cocktailRecipeImage.create({
          data: {
            cocktailRecipeId: cocktailId,
            image: image,
          },
        });
      }

      // Steps & Ingredients differenziell aktualisieren
      const existingSteps = oldCocktail?.steps ?? [];
      const existingStepMap = new Map(existingSteps.map((s) => [s.id, s]));

      const incomingSteps = (steps as CocktailRecipeStepFull[]) ?? [];
      const existingIncomingSteps = incomingSteps.filter((s: any) => s.id && s.id !== '');
      const incomingStepIds = new Set(existingIncomingSteps.map((s: any) => s.id));

      // Zu löschende Steps
      const stepsToDelete = existingSteps.filter((s) => !incomingStepIds.has(s.id));
      for (const step of stepsToDelete) {
        await tx.cocktailRecipeStep.delete({
          where: { id: step.id },
        });
      }

      // Vorhandene Steps aktualisieren
      for (const step of existingIncomingSteps) {
        const updatedStep = await tx.cocktailRecipeStep.update({
          where: { id: step.id },
          data: {
            stepNumber: step.stepNumber,
            optional: step.optional,
            actionId: step.actionId,
          },
        });

        const oldStep = existingStepMap.get(step.id);
        const existingIngredients = oldStep?.ingredients ?? [];
        const existingIngredientIds = new Set(existingIngredients.map((i) => i.id));

        const incomingIngredients = (step.ingredients ?? []) as any[];
        const incomingExistingIngredients = incomingIngredients.filter((i) => i.id && i.id !== '');
        const incomingIngredientIds = new Set(incomingExistingIngredients.map((i) => i.id));

        // Ingredients löschen, die es nicht mehr gibt
        const ingredientsToDelete = existingIngredients.filter((i) => !incomingIngredientIds.has(i.id));
        for (const ing of ingredientsToDelete) {
          await tx.cocktailRecipeIngredient.delete({
            where: { id: ing.id },
          });
        }

        // Vorhandene Ingredients aktualisieren
        for (const ing of incomingExistingIngredients) {
          await tx.cocktailRecipeIngredient.update({
            where: { id: ing.id },
            data: {
              amount: ing.amount,
              optional: ing.optional,
              ingredientNumber: ing.ingredientNumber,
              unitId: ing.unitId,
              ingredientId: ing.ingredientId,
            },
          });
        }

        // Neue Ingredients anlegen
        const newIngredients = incomingIngredients.filter((i) => !i.id || i.id === '');
        for (const ing of newIngredients) {
          await tx.cocktailRecipeIngredient.create({
            data: {
              amount: ing.amount,
              optional: ing.optional,
              ingredientNumber: ing.ingredientNumber,
              unitId: ing.unitId,
              ingredientId: ing.ingredientId,
              cocktailRecipeStepId: updatedStep.id,
            },
          });
        }
      }

      // Neue Steps anlegen (ohne vorhandene ID)
      const newSteps = incomingSteps.filter((s: any) => !s.id || s.id === '');
      for (const step of newSteps) {
        const createdStep = await tx.cocktailRecipeStep.create({
          data: {
            actionId: step.actionId,
            stepNumber: step.stepNumber,
            optional: step.optional,
            cocktailRecipeId: updatedCocktail.id,
          },
        });

        const incomingIngredients = (step.ingredients ?? []) as any[];
        for (const ing of incomingIngredients) {
          await tx.cocktailRecipeIngredient.create({
            data: {
              amount: ing.amount,
              optional: ing.optional,
              ingredientNumber: ing.ingredientNumber,
              unitId: ing.unitId,
              ingredientId: ing.ingredientId,
              cocktailRecipeStepId: createdStep.id,
            },
          });
        }
      }

      // Garnishes differenziell über Composite Key aktualisieren
      const existingGarnishes = oldCocktail?.garnishes ?? [];
      const existingGarnishIds = new Set(existingGarnishes.map((g) => g.garnishId));

      const incomingGarnishes = (garnishes as CocktailRecipeGarnishFull[]) ?? [];
      const incomingGarnishIds = new Set(incomingGarnishes.map((g) => g.garnishId));

      // Garnishes löschen, die es nicht mehr gibt
      const garnishIdsToDelete = Array.from(existingGarnishIds).filter((id) => !incomingGarnishIds.has(id));
      if (garnishIdsToDelete.length > 0) {
        await tx.cocktailRecipeGarnish.deleteMany({
          where: {
            cocktailRecipeId: cocktailId,
            garnishId: { in: garnishIdsToDelete },
          },
        });
      }

      // Vorhandene Garnishes aktualisieren
      for (const garnish of incomingGarnishes) {
        if (existingGarnishIds.has(garnish.garnishId)) {
          await tx.cocktailRecipeGarnish.update({
            where: {
              garnishId_cocktailRecipeId: {
                garnishId: garnish.garnishId,
                cocktailRecipeId: cocktailId,
              },
            },
            data: {
              garnishNumber: garnish.garnishNumber,
              description: garnish.description,
              optional: garnish.optional,
              isAlternative: (garnish as any).isAlternative,
            },
          });
        } else {
          // Neue Garnish-Beziehung anlegen
          await tx.cocktailRecipeGarnish.create({
            data: {
              cocktailRecipeId: cocktailId,
              garnishId: garnish.garnishId,
              garnishNumber: garnish.garnishNumber,
              description: garnish.description,
              optional: garnish.optional,
              isAlternative: (garnish as any).isAlternative,
            },
          });
        }
      }

      const fullNewCocktail = await tx.cocktailRecipe.findUnique({
        where: { id: cocktailId },
        include: {
          ice: true,
          glass: true,
          garnishes: { include: { garnish: true } },
          steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
          CocktailRecipeImage: true,
        },
      });

      await createCocktailRecipeAuditLog(tx, workspace.id, user.id, cocktailId, 'UPDATE', oldCocktail, fullNewCocktail);

      return updatedCocktail;
    });

    return res.json(result);
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.ADMIN],
    Permission.COCKTAILS_DELETE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const cocktailId = req.query.cocktailId as string | undefined;
      if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

      await prisma.$transaction(async (tx) => {
        const oldCocktail = await tx.cocktailRecipe.findUnique({
          where: { id: cocktailId },
          include: {
            ice: true,
            glass: true,
            garnishes: { include: { garnish: true } },
            steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
            CocktailRecipeImage: true,
          },
        });

        await tx.cocktailRecipeIngredient.deleteMany({
          where: {
            cocktailRecipeStep: {
              cocktailRecipeId: cocktailId,
            },
          },
        });
        await tx.cocktailRecipeStep.deleteMany({
          where: {
            cocktailRecipeId: cocktailId,
          },
        });
        await tx.cocktailRecipe.delete({
          where: {
            id: cocktailId,
            workspaceId: workspace.id,
          },
        });

        await createCocktailRecipeAuditLog(tx, workspace.id, user.id, cocktailId, 'DELETE', oldCocktail, null);
      });

      return res.json({ data: { count: 1 } }); // Return success
    },
  ),
});
