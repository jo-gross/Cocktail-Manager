import { GlassForm } from '../../../../../components/glasses/GlassForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@prisma/client';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '../../../../../components/layout/SingleFormLayout';
import { GlassWithImage } from '../../../../../models/GlassWithImage';

function EditGlassPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [glass, setGlass] = useState<GlassWithImage | undefined>(undefined);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

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
          console.error('GlassId -> fetchGlass', response);
          alertService.error(body.message ?? 'Fehler beim Laden des Glases', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('GlassId -> fetchGlass', error);
        alertService.error('Fehler beim Laden des Glases');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/glasses`} title={'Gläser'} unsavedChanges={unsavedChanges} formRef={formRef}>
      <SingleFormLayout title={'Glas erfassen'}>
        <GlassForm glass={glass} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      </SingleFormLayout>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGlassPage, '/workspaces/[workspaceId]/manage');
