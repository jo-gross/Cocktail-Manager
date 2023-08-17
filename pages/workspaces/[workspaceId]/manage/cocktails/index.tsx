import { CocktailRecipe } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import { useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';

export default function CocktailsOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/cocktails`)
      .then((response) => response.json())
      .then((data) => {
        setCocktailRecipes(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Cocktails'}>
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th className="">Name</th>
                  <th className="">Preis</th>
                  <th className="">Tags</th>
                  <th className="flex justify-end">
                    <Link href={`/workspaces/${workspaceId}/manage/cocktails/create`}>
                      <div className={'btn btn-primary btn-sm'}>Hinzufügen</div>
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={'w-full'}>
                    <td colSpan={4}>
                      <Loading />
                    </td>
                  </tr>
                ) : cocktailRecipes.length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  cocktailRecipes
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((cocktailRecipe) => (
                      <tr key={cocktailRecipe.id}>
                        <td>{cocktailRecipe.name}</td>
                        <td>{cocktailRecipe.price} €</td>
                        <td className={'space-x-2'}>
                          {cocktailRecipe.tags.map((tag) => (
                            <div key={`cocktail-${cocktailRecipe.id}-tags-${tag}`} className={'badge badge-primary'}>
                              {tag}
                            </div>
                          ))}
                        </td>
                        <ManageColumn entity={'cocktails'} id={cocktailRecipe.id} />
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}
