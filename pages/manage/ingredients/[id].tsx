import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { IngredientForm } from "../../../components/ingredients/IngredientForm";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

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
  return <ManageEntityLayout backLink={"/manage"} title={"Zutaten"}>
    <IngredientForm ingredient={props.ingredient} />
  </ManageEntityLayout>;
}
