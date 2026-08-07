import { GlassForm, GlassFormValues } from '@components/glasses/GlassForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '@components/layout/SingleFormLayout';
import type { GlassDto } from '@lib/schemas/glasses';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';

function EditGlassPage() {
  const router = useRouter();
  const { t } = useTranslation(['nav', 'entity', 'errors']);
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [glass, setGlass] = useState<GlassDto | undefined>(undefined);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef = useRef<FormikProps<GlassFormValues>>(null);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    apiV1FetchSafe<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses/${id}`, undefined, t('errors:loadGlass'))
      .then((data) => {
        if (data) setGlass(data);
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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/glasses`} title={t('nav:glasses')} unsavedChanges={unsavedChanges} formRef={formRef}>
      <SingleFormLayout title={t('entity:formTitle.glass')}>
        <GlassForm glass={glass} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      </SingleFormLayout>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGlassPage, '/workspaces/[workspaceId]/manage');
