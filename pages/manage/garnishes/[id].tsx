import { GarnishForm } from '../../../components/garnishes/GarnishForm';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Garnish } from '@prisma/client';
import { Loading } from '../../../components/Loading';

export default function EditGarnishPage() {
  const router = useRouter();
  const { id } = router.query;

  const [garnish, setGarnish] = useState<Garnish | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/garnishes/${id}`)
        .then((response) => response.json())
        .then((data) => {
          setGarnish(data);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={'/manage'} title={'Garnitur'}>
      <GarnishForm garnish={garnish} />
    </ManageEntityLayout>
  );
}
