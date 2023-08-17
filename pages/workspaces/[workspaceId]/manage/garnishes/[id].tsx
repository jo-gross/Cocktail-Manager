import { GarnishForm } from '../../../../../components/garnishes/GarnishForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Garnish } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';

export default function EditGarnishPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [garnish, setGarnish] = useState<Garnish | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/garnishes/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setGarnish(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Garnitur'}>
      <GarnishForm garnish={garnish} />
    </ManageEntityLayout>
  );
}
