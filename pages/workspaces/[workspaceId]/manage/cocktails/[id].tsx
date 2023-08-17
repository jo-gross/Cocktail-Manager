import { CocktailRecipeForm } from '../../../../../components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';

export default function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFull | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setCocktailRecipe(data);
      })
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
