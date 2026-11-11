import { GlassForm, GlassFormValues } from '@components/glasses/GlassForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Role } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import type { GlassDto } from '@lib/schemas/glasses';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';

function EditGlassPage() {
  const router = useRouter();
  const { t } = useTranslation(['nav', 'entity', 'errors']);
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [glass, setGlass] = useState<GlassDto | undefined>(undefined);

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
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/glasses`}
      title={glass?.name ?? t('entity:formTitle.glass')}
      subtitle={glass ? t('nav:glasses') : undefined}
      formRef={formRef}
      showUnsavedHint={false}
    >
      <GlassForm glass={glass} formRef={formRef} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGlassPage, '/workspaces/[workspaceId]/manage');
