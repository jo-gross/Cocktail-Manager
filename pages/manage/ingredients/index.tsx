import prisma from "../../../lib/prisma";
import { GetServerSideProps } from "next";
import { Ingredient } from "@prisma/client";
import Link from "next/link";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";
import { ManageColumn } from "../../../components/ManageColumn";
import { FaCheck, FaTimes } from "react-icons/fa";
import React from "react";

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
                <th className="w-1/8">Preis/Menge</th>
                <th className="w-1/8">Tags</th>
                <th className="w-1/8">Link</th>
                <th className="w-1/8">
                  <div className={"w-full flex justify-end"}>
                    <Link href={"/manage/ingredients/create"}>
                      <div className={"btn btn-primary btn-sm"}>Hinzufügen</div>
                    </Link>
                  </div>
                </th>
              </tr>
              </thead>
              <tbody>
              {props.ingredients.sort((a, b) => a.name.localeCompare(b.name)).map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className={""}>
                    {ingredient.image ?
                      <div className="flex items-center space-x-3">
                        <div className="avatar">
                          <div className="mask mask-squircle w-12 h-12">
                            <img src={ingredient.image} className={"w-8 h-8 rounded-full mr-2"} />
                          </div>
                        </div>
                        {ingredient.name}
                      </div>
                      : <>
                        {ingredient.name}
                      </>
                    }
                  </td>
                  <td>{ingredient.shortName}</td>
                  <td>{ingredient.price} €</td>
                  <td>{ingredient.volume} {ingredient.unit}</td>
                  <td>{(ingredient.price / ingredient.volume).toFixed(2)} €</td>
                  <td>{ingredient.tags.map((tag) => <div className={"badge badge-primary badge-outline m-1"}>{tag}</div>)}</td>
                  <td>{ingredient.link == undefined ? <div className={"text-red-500"}><FaTimes /></div> : <div className={"text-success"}><FaCheck /></div>}</td>
                  <ManageColumn entity={"ingredients"} id={ingredient.id} />
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
