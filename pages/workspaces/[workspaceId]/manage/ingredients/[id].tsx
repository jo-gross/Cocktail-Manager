import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { Role } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { IngredientForm } from '../../../../../components/ingredients/IngredientForm';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { FormikProps } from 'formik';
import { SingleFormLayout } from '../../../../../components/layout/SingleFormLayout';
import { IngredientWithImage } from '../../../../../models/IngredientWithImage';
import { PageCenter } from '../../../../../components/layout/PageCenter';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [ingredient, setIngredient] = useState<IngredientWithImage | undefined>(undefined);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/ingredients/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setIngredient(body.data);
        } else {
          console.error('IngredientId -> fetchIngredient', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Zutat', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('IngredientId -> fetchIngredient', error);
        alertService.error('Fehler beim Laden der Zutat');
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
