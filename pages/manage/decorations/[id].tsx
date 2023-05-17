import { DecorationForm } from '../../../components/decorations/DecorationForm';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Decoration } from '@prisma/client';
import { Loading } from '../../../components/Loading';

export default function EditDecorationPage() {
  const router = useRouter();
  const { id } = router.query;

  const [decoration, setDecoration] = useState<Decoration | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/decorations/${id}`)
        .then((response) => response.json())
        .then((data) => {
          setDecoration(data);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={'/manage'} title={'Dekoration'}>
      <DecorationForm decoration={decoration} />
    </ManageEntityLayout>
  );
}
