import prisma from "../../../lib/prisma";


// DELETE /api/cocktails/:id

export default async function handle(req, res) {
  const id = req.query.id;
  if (req.method === "DELETE") {
    const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.deleteMany({
      where: {
        cocktailRecipeStep: {
          cocktailRecipeId: id
        }
      }
    });
    const cocktailRecipeSteps = await prisma.cocktailRecipeStep.deleteMany({
      where: {
        cocktailRecipeId: id
      }
    });
    const result = await prisma.cocktailRecipe.delete({
      where: {
        id: id
      }
    });
    return res.json(result);
  } else {
    throw new Error(
      `The HTTP ${req.method} method is not supported at this route.`
    );
  }
}
