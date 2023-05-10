import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { DecorationForm } from "../../../components/decorations/DecorationForm";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const decoration = await prisma.decoration.findUnique({
    where: {
      id: String(params.id)
    }
  });

  return {
    props: { decoration }
  };
};
export default function EditDecorationPage(props: { decoration }) {
  return <ManageEntityLayout backLink={"/manage"} title={"Dekoration"}>
    <DecorationForm decoration={props.decoration} />
  </ManageEntityLayout>;
}
