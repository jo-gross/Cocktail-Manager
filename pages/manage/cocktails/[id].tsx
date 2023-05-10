import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { CocktailRecipeForm } from "../../../components/CocktailRecipe/CocktailRecipeForm";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const glassesPromise = prisma.glass.findMany();
  const decorationsPromise = prisma.decoration.findMany();
  const ingredientsPromise = prisma.ingredient.findMany();

  const [glasses, decorations, ingredients] = await Promise.all([glassesPromise, decorationsPromise, ingredientsPromise]);
  if (params.id == "create") {
    return {
      props: { glasses, decorations, ingredients }
    };
  } else {
    const cocktailRecipe = await prisma.cocktailRecipe.findUnique({
      where: {
        id: String(params.id)
      },
      include: {
        glass: true,
        decoration: true,
        steps: {
          include: {
            ingredients: {
              include: {
                ingredient: true
              }
            }
          }
        }
      }
    });

    return {
      props: { glasses, cocktailRecipe, decorations, ingredients }
    };
  }
};


export default function EditCocktailRecipe(props: { glasses; cocktailRecipe; decorations; ingredients }) {
  return <CocktailRecipeForm cocktailRecipe={props.cocktailRecipe}
                             glasses={props.glasses ?? []}
                             decorations={props.decorations ?? []}
                             ingredients={props.ingredients ?? []} />;
}
