import { GlassForm, GlassFormValues } from '@components/glasses/GlassForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { Role } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import type { GlassDto } from '@lib/schemas/glasses';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';
import { useEntityEditor } from '@lib/forms/useEntityEditor';

function EditGlassPage() {
  const { t } = useTranslation(['nav', 'entity', 'errors']);
  const {
    entity: glass,
    loading,
    workspaceId,
  } = useEntityEditor<GlassDto>((workspaceId, id) =>
    apiV1FetchSafe<GlassDto>(`/api/v1/workspaces/${workspaceId}/glasses/${id}`, undefined, t('errors:loadGlass')),
  );

  const formRef = useRef<FormikProps<GlassFormValues>>(null);

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
