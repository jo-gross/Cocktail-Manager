import { GarnishForm } from '../../../../../components/garnishes/GarnishForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Garnish, Role } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';

function EditGarnishPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [garnish, setGarnish] = useState<Garnish | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/garnishes/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGarnish(body.data);
        } else {
          console.log('GarnishId -> fetchGarnish', response, body);
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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Garnitur'}>
      <GarnishForm garnish={garnish} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGarnishPage, '/workspaces/[workspaceId]/manage');
