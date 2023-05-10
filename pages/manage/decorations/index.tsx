import prisma from "../../../lib/prisma";
import { Decoration } from "@prisma/client";
import Link from "next/link";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps = async () => {
  const decoration: Decoration[] = await prisma.decoration.findMany();
  return {
    props: { decoration }
  };
};

export default function ManageGlassesOverviewPage(props: { decoration }) {
  return (
    <ManageEntityLayout title={"Dekorationen"} backLink={"/manage"}>
      <div className={"card"}>
        <div className={"card-body"}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
              <tr>
                <th className="">Name</th>
                <th className="">Preis</th>
                <th className="flex justify-end">
                  <Link href={"/manage/decorations/create"}>
                    <div className={"btn btn-primary btn-sm"}>Hinzufügen</div>
                  </Link>
                </th>
              </tr>
              </thead>
              <tbody>
              {props.decoration.map((glass) => (
                <tr className={"p-4"} key={glass.id}>
                  <td>
                    <div className="font-bold">
                      {glass.name}
                    </div>
                  </td>
                  <td>
                    {glass.price} €
                  </td>
                  <td>
                    <div className={"flex justify-end items-center"}>
                      <Link href={`/manage/decorations/${glass.id}`}>
                        <div className={"btn btn-primary btn-sm"}>Edit</div>
                      </Link>
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
