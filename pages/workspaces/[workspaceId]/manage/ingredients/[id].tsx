import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { Ingredient, Role } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { IngredientForm } from '../../../../../components/ingredients/IngredientForm';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);

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
          console.log('IngredientId -> fetchIngredient', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/ingredients`} title={'Zutaten'}>
      <IngredientForm ingredient={ingredient} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
