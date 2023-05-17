import { CocktailRecipeForm } from '../../../components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { CocktailRecipeFull } from '../../../models/CocktailRecipeFull';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../components/Loading';

export default function EditCocktailRecipe() {
  const router = useRouter();
  const { id } = router.query;

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFull | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/cocktails/${id}`)
        .then((response) => response.json())
        .then((data) => {
          setCocktailRecipe(data);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  return loading ? (
    <Loading />
  ) : (
    <ManageEntityLayout backLink={'/manage/cocktails'} title={'Cocktail'}>
      <CocktailRecipeForm cocktailRecipe={cocktailRecipe} />
    </ManageEntityLayout>
  );
}
