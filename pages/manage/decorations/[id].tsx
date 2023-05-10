import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { DecorationForm } from "../../../components/decorations/DecorationForm";

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
  return <DecorationForm decoration={props.decoration} />;
}
