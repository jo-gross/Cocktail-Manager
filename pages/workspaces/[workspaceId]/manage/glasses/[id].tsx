import { GlassForm } from '../../../../../components/glasses/GlassForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Glass } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';

export default function EditGlassPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [glass, setGlass] = useState<Glass | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/glasses/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setGlass(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Gläser'}>
      <GlassForm glass={glass} />
    </ManageEntityLayout>
  );
}
