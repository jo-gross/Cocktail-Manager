import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";
import { Formik } from "formik";

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
    <Formik initialValues={{}} onSubmit={() => {
    }}>
    </Formik>
  </ManageEntityLayout>;
}
