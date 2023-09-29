import { GlassForm } from '../../../../../components/glasses/GlassForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Glass, Role } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';

function EditGlassPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [glass, setGlass] = useState<Glass | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/glasses/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGlass(body.data);
        } else {
          console.log('GlassId -> fetchGlass', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
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

export default withPagePermission([Role.MANAGER], EditGlassPage, '/workspaces/[workspaceId]/manage');
