import prisma from "../../../lib/prisma";
import { Glass } from "@prisma/client";
import Link from "next/link";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps = async () => {
  const glasses: Glass[] = await prisma.glass.findMany();
  return {
    props: { glasses }
  };
};

export default function ManageGlassesOverviewPage(props: { glasses }) {
  return (
    <ManageEntityLayout backLink={"/manage"} title={"Gläser"}>
      <div className={"card"}>
        <div className={"card-body"}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
              <tr>
                <th className="">Name</th>
                <th className="">Pfand</th>
                <th className="flex justify-end">
                  <Link href={"/manage/glasses/create"}>
                    <div className={"btn btn-primary btn-sm"}>Hinzufügen</div>
                  </Link>
                </th>
              </tr>
              </thead>
              <tbody>
              {props.glasses.map((glass) => (
                <tr className={"p-4"} key={glass.id}>
                  <td>
                    <div className="flex items-center space-x-3">
                      <div className="avatar">
                        <div className="mask mask-squircle w-12 h-12">
                          <img src={glass.image} alt="Avatar Tailwind CSS Component" />
                        </div>
                      </div>
                      <div className="font-bold">
                        {glass.name}
                      </div>
                    </div>
                  </td>
                  <td>
                    {glass.deposit} €
                  </td>
                  <td>
                    <div className={"flex justify-end items-center"}>
                      <Link href={`/manage/glasses/${glass.id}`}>
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
