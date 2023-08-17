import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { Ingredient } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { IngredientForm } from '../../../../../components/ingredients/IngredientForm';

export default function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/ingredients/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setIngredient(data);
      })
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
