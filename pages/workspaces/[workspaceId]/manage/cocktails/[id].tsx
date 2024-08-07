import { CocktailRecipeForm } from '../../../../../components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { Role } from '@prisma/client';
import { FormikProps } from 'formik';
import { CocktailRecipeFullWithImage } from '../../../../../models/CocktailRecipeFullWithImage';
import { PageCenter } from '../../../../../components/layout/PageCenter';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFullWithImage | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailRecipe(body.data);
        } else {
          console.error('CocktailId -> fetchCocktail', response);
          alertService.error(body.message ?? 'Fehler beim Laden des Cocktails', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CocktailId -> fetchCocktail', error);
        alertService.error('Fehler beim Laden des Cocktails');
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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/cocktails`} title={'Cocktail'} unsavedChanges={unsavedChanges} formRef={formRef}>
      <CocktailRecipeForm cocktailRecipe={cocktailRecipe} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
