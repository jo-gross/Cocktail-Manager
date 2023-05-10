import { GetServerSideProps } from 'next';
import prisma from '../../../lib/prisma';
import { GlassForm } from '../../../components/glasses/GlassForm';

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const glass = await prisma.glass.findUnique({
    where: {
      id: String(params.id),
    },
  });

  return {
    props: { glass },
  };
};
export default function EditGlassPage(props: { glass }) {
  return <GlassForm glass={props.glass} />;
}
