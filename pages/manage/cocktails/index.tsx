import prisma from "../../../lib/prisma";
import { GetServerSideProps } from "next";
import { CocktailRecipe } from "@prisma/client";
import Link from "next/link";
import { FaTrashAlt } from "react-icons/fa";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const cocktailRecipes: CocktailRecipe[] = await prisma.cocktailRecipe.findMany();

  return {
    props: { cocktailRecipes }
  };
};

export default function CocktailsOverviewPage(props: { cocktailRecipes }) {
  return (
    <ManageEntityLayout backLink={"/manage"} title={"Cocktails"}>
      <div className={"card"}>
        <div className={"card-body"}>


          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
              <tr>
                <th className="">Name</th>
                <th className="">Preis</th>
                <th className="">Tags</th>
                <th className="flex justify-end">
                  <Link href={"/manage/cocktails/create"}>
                    <div className={"btn btn-primary btn-sm"}>Hinzufügen</div>
                  </Link>
                </th>
              </tr>
              </thead>
              <tbody>
              {props.cocktailRecipes.map((cocktailRecipe) => (
                <tr key={cocktailRecipe.id}>
                  <td>{cocktailRecipe.name}</td>
                  <td>{cocktailRecipe.price} €</td>
                  <td className={"space-x-2"}>
                    {cocktailRecipe.tags.map((tag) => (
                      <div className={"badge badge-primary"}>{tag}</div>
                    ))}
                  </td>
                  <td className={"flex justify-end space-x-2"}>
                    <a href={`/manage/cocktails/${cocktailRecipe.id}`}>
                      <div className={"btn btn-outline btn-primary btn-sm"}>Edit</div>
                    </a>
                    <div className={"btn btn-outline btn-error btn-sm"}
                         onClick={async () => {
                           try {
                             const response = await fetch(`/api/cocktails/${cocktailRecipe.id}`, {
                               method: "DELETE"
                             });
                             if (response.status == 200) {
                               window.location.reload();
                             } else {
                               console.log(response);
                               alert("Fehler beim Löschen");
                             }
                           } catch (e) {
                             console.error(e);
                             alert("Fehler beim Löschen");
                           }
                         }
                         }>
                      <FaTrashAlt />
                    </div>
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
