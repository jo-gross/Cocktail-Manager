import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { IngredientForm } from "../../../components/ingredients/IngredientForm";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {

  if (params.id == "create") {
    return {
      props: {}
    };
  } else {
    const ingredient = await prisma.ingredient.findUnique({
      where: {
        id: String(params.id)
      }
    });

    return {
      props: { ingredient }
    };
  }
};


export default function EditCocktailRecipe(props: { ingredient }) {
  return <IngredientForm ingredient={props.ingredient} />;
}
