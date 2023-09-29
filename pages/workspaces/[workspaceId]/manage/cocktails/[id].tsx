import { CocktailRecipeForm } from '../../../../../components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { Role } from '@prisma/client';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFull | undefined>(undefined);
  const [loading, setLoading] = useState(true);

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
          console.log('CocktailId -> fetchRecipe', response, body);
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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage/cocktails`} title={'Cocktail'}>
      <CocktailRecipeForm cocktailRecipe={cocktailRecipe} />
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
