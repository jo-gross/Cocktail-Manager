import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { Role } from '@generated/prisma/client';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { Loading } from '@components/Loading';
import { IngredientForm, FormValue } from '@components/ingredients/IngredientForm';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import type { IngredientDto } from '@lib/schemas/ingredients';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';
import { useEntityEditor } from '@lib/forms/useEntityEditor';

function EditCocktailRecipe() {
  const { t } = useTranslation(['nav', 'entity', 'errors']);
  const {
    entity: ingredient,
    loading,
    workspaceId,
  } = useEntityEditor<IngredientDto>((workspaceId, id) =>
    apiV1FetchSafe<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients/${id}`, undefined, t('errors:loadIngredient')),
  );

  const formRef = useRef<FormikProps<FormValue>>(null);

  return loading ? (
    <PageCenter>
      <Loading />
    </PageCenter>
  ) : (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/ingredients`}
      title={ingredient?.name ?? t('entity:formTitle.ingredient')}
      subtitle={ingredient ? t('nav:ingredients') : undefined}
      formRef={formRef}
      showUnsavedHint={false}
    >
      <IngredientForm ingredient={ingredient} formRef={formRef} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
