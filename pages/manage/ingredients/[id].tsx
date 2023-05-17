import { IngredientForm } from '../../../components/ingredients/IngredientForm';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { Ingredient } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading';

export default function EditCocktailRecipe() {
  const router = useRouter();
  const { id } = router.query;

  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ingredients/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setIngredient(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={'/manage/ingredients'} title={'Zutaten'}>
      <IngredientForm ingredient={ingredient} />
    </ManageEntityLayout>
  );
}
