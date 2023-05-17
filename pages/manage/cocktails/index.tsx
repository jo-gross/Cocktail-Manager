import { CocktailRecipe } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../components/ManageColumn';
import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading';

export default function CocktailsOverviewPage() {
  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cocktails')
      .then((response) => response.json())
      .then((data) => {
        setCocktailRecipes(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <ManageEntityLayout backLink={'/manage'} title={'Cocktails'}>
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
                    <Link href={'/manage/cocktails/create'}>
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
