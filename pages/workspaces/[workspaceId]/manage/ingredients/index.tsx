import { Ingredient } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { ManageColumn } from '../../../../../components/ManageColumn';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';

export default function IngredientsOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshIngredients = useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/ingredients`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setIngredients(body.data);
        } else {
          console.log('Ingredients -> fetchIngredients', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshIngredients();
  }, [refreshIngredients]);

  return (
    <ManageEntityLayout
      title={'Zutaten'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={
        userContext.isUserManager() ? (
          <Link href={`/workspaces/${workspaceId}/manage/ingredients/create`}>
            <div className={'btn btn-primary'}>Hinzufügen</div>
          </Link>
        ) : undefined
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th className="w-1/2">Name</th>
                  <th className="w-1/4">Abkürzung</th>
                  <th className="w-1/8">Preis</th>
                  <th className="w-1/8">Menge</th>
                  <th className="w-1/8">Preis/Menge</th>
                  <th className="w-1/8">Tags</th>
                  <th className="w-1/8">Link</th>
                  <th className="w-1/8">Seite</th>
                  <th className="w-1/8"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8}>
                      <Loading />
                    </td>
                  </tr>
                ) : ingredients.length == 0 ? (
                  <tr>
                    <td colSpan={8} className="{'text-center'}">
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  ingredients
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ingredient) => (
                      <tr key={ingredient.id}>
                        <td className={''}>
                          {ingredient.image ? (
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12">
                                <AvatarImage src={ingredient.image} alt={'Cocktail'} />
                              </div>
                              <div>{ingredient.name}</div>
                            </div>
                          ) : (
                            <>{ingredient.name}</>
                          )}
                        </td>
                        <td>{ingredient.shortName}</td>
                        <td>{ingredient.price} €</td>
                        <td>
                          {ingredient.volume} {ingredient.unit}
                        </td>
                        <td>{((ingredient.price ?? 0) / (ingredient.volume ?? 1)).toFixed(2)} €</td>
                        <td>
                          {ingredient.tags.map((tag) => (
                            <div
                              key={`ingredient-${ingredient.id}-tags-${tag}`}
                              className={'badge badge-primary badge-outline m-1'}
                            >
                              {tag}
                            </div>
                          ))}
                        </td>
                        <td>
                          {ingredient.link
                            ?.replace('https://', '')
                            .replace('http://', '')
                            .replace('www.', '')
                            .substring(
                              0,
                              ingredient.link
                                ?.replace('https://', '')
                                .replace('http://', '')
                                .replace('www.', '')
                                .indexOf('/'),
                            ) ?? ''}
                        </td>
                        <td>
                          {ingredient.link == undefined ? (
                            <div className={'text-red-500'}>
                              <FaTimes />
                            </div>
                          ) : (
                            <div className={'text-success'}>
                              <FaCheck />
                            </div>
                          )}
                        </td>
                        <ManageColumn entity={'ingredients'} id={ingredient.id} onRefresh={refreshIngredients} />
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
