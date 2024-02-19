import { GarnishForm } from '../../../../../components/garnishes/GarnishForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '../../../../../components/layout/SingleFormLayout';
import { GarnishWithImage } from '../../../../../models/GarnishWithImage';

function EditGarnishPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [garnish, setGarnish] = useState<GarnishWithImage | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

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
          console.error('GarnishId -> fetchGarnish', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Garnitur', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('GarnishId -> fetchGarnish', error);
        alertService.error('Fehler beim Laden der Garnitur');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/garnishes`} title={'Garnitur'} unsavedChanges={unsavedChanges} formRef={formRef}>
      <SingleFormLayout title={'Garnitur erfassen'}>
        <GarnishForm garnish={garnish} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      </SingleFormLayout>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGarnishPage, '/workspaces/[workspaceId]/manage');
