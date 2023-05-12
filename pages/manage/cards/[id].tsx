import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const cocktailsPromise = prisma.cocktailRecipe.findMany();

  const [cocktails] = await Promise.all([cocktailsPromise]);
  if (params.id == "create") {
    return {
      props: { cocktails }
    };
  } else {
    const card = await prisma.cocktailCard.findUnique({
      where: {
        id: String(params.id)
      },
      include: {
        groups: {
          include: {
            items: true
          }
        }
      }
    });

    return {
      props: { cocktails, card }
    };
  }
};


export default function EditCocktailRecipe(props: { glasses; cocktailRecipe; decorations; ingredients }) {
  return <ManageEntityLayout backLink={"/manage"} title={"Cocktail"}>
    <div></div>
  </ManageEntityLayout>;
}
