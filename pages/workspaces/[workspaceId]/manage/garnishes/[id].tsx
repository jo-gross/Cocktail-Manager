import { GarnishForm, GarnishFormValues } from '@components/garnishes/GarnishForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { Role } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import type { GarnishDto } from '@lib/schemas/garnishes';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';
import { useEntityEditor } from '@lib/forms/useEntityEditor';

function EditGarnishPage() {
  const { t } = useTranslation(['nav', 'entity', 'errors']);
  const {
    entity: garnish,
    loading,
    workspaceId,
  } = useEntityEditor<GarnishDto>((workspaceId, id) =>
    apiV1FetchSafe<GarnishDto>(`/api/v1/workspaces/${workspaceId}/garnishes/${id}`, undefined, t('errors:loadGarnish')),
  );

  const formRef = useRef<FormikProps<GarnishFormValues>>(null);

  return loading ? (
    <PageCenter>
      <Loading />
    </PageCenter>
  ) : (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/garnishes`}
      title={garnish?.name ?? t('entity:formTitle.garnish')}
      subtitle={garnish ? t('nav:garnishes') : undefined}
      formRef={formRef}
      showUnsavedHint={false}
    >
      <GarnishForm garnish={garnish} formRef={formRef} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditGarnishPage, '/workspaces/[workspaceId]/manage');
