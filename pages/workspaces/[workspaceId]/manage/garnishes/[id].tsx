import { GarnishForm, GarnishFormValues } from '@components/garnishes/GarnishForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '@components/layout/SingleFormLayout';
import type { GarnishDto } from '@lib/schemas/garnishes';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';

function EditGarnishPage() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [garnish, setGarnish] = useState<GarnishDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef = useRef<FormikProps<GarnishFormValues>>(null);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    apiV1FetchSafe<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes/${id}`, undefined, 'Fehler beim Laden der Garnitur')
      .then((data) => {
        if (data) setGarnish(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <PageCenter>
      <Loading />
    </PageCenter>
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/garnishes`} title={'Garnitur'} unsavedChanges={unsavedChanges} formRef={formRef}>
      <SingleFormLayout title={'Garnitur erfassen'}>
        <GarnishForm garnish={garnish} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      </SingleFormLayout>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGarnishPage, '/workspaces/[workspaceId]/manage');
