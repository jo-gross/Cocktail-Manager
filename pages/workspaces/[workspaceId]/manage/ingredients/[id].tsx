import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { Role } from '@generated/prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Loading } from '@components/Loading';
import { IngredientForm, FormValue } from '@components/ingredients/IngredientForm';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '@components/layout/SingleFormLayout';
import type { IngredientDto } from '@lib/schemas/ingredients';
import { PageCenter } from '@components/layout/PageCenter';
import { apiV1FetchSafe } from '@lib/network/apiV1';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [ingredient, setIngredient] = useState<IngredientDto | undefined>(undefined);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef = useRef<FormikProps<FormValue>>(null);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    apiV1FetchSafe<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients/${id}`, undefined, 'Fehler beim Laden der Zutat')
      .then((data) => {
        if (data) setIngredient(data);
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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/ingredients`} title={'Zutaten'} unsavedChanges={unsavedChanges} formRef={formRef}>
      <SingleFormLayout title={'Zutat erfassen'}>
        <IngredientForm ingredient={ingredient} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      </SingleFormLayout>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
