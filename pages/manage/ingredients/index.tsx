import prisma from "../../../lib/prisma";
import { GetServerSideProps } from "next";
import { Ingredient } from "@prisma/client";
import Link from "next/link";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const ingredients: Ingredient[] = await prisma.ingredient.findMany();

  return {
    props: { ingredients }
  };
};

export default function IngredientsOverviewPage(props: { ingredients }) {
  return (
    <ManageEntityLayout title={"Zutaten"} backLink={"/manage"}>
      <div className={"card"}>
        <div className={"card-body"}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
              <tr>
                <th className="w-1/2">Name</th>
                <th className="w-1/4">Abkürzung</th>
                <th className="w-1/8">Preis</th>
                <th className="w-1/8">Menge</th>
                <th className="w-1/4">
                  <div className={"w-full flex justify-end"}>
                    <Link href={"/manage/ingredients/create"}>
                      <div className={"btn btn-primary btn-sm"}>Hinzufügen</div>
                    </Link>
                  </div>
                </th>
              </tr>
              </thead>
              <tbody>
              {props.ingredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td>{ingredient.name}</td>
                  <td>{ingredient.shortName}</td>
                  <td>{ingredient.price} €</td>
                  <td>{ingredient.volume} {ingredient.unit}</td>
                  <td className={"flex justify-end"}>
                    <a href={`/manage/ingredients/${ingredient.id}`}>
                      <div className={"btn btn-outline btn-primary btn-sm"}>Edit</div>
                    </a>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}
