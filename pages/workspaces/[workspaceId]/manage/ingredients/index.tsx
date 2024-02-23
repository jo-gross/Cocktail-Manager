import { Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';
import { FaCheck, FaInfoCircle, FaPlus, FaTimes } from 'react-icons/fa';
import { ManageColumn } from '../../../../../components/ManageColumn';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import ListSearchField from '../../../../../components/ListSearchField';
import { IngredientModel } from '../../../../../models/IngredientModel';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';

export default function IngredientsOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');

  const refreshIngredients = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/ingredients`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setIngredients(body.data);
        } else {
          console.error('Ingredients -> fetchIngredients', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Zutaten', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Ingredients -> fetchIngredients', error);
        alertService.error('Fehler beim Laden der Zutaten');
      })
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
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/ingredients/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        ) : undefined
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
          <div className="overflow-x-auto">
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Abkürzung</th>
                  <th>Notizen</th>
                  <th>Preis</th>
                  <th>Menge</th>
                  <th>Preis/Menge</th>
                  <th>Tags</th>
                  <th>Link</th>
                  <th>Seite</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10}>
                      <Loading />
                    </td>
                  </tr>
                ) : ingredients.filter(
                    (ingredient) =>
                      ingredient.name.toLowerCase().includes(filterString.toLowerCase()) ||
                      ingredient.tags.some((tag) => tag.toLowerCase().includes(filterString.toLowerCase())),
                  ).length == 0 ? (
                  <tr>
                    <td colSpan={10} className="{'text-center'}">
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  ingredients
                    .filter(
                      (ingredient) =>
                        ingredient.name.toLowerCase().includes(filterString.toLowerCase()) ||
                        ingredient.tags.some((tag) => tag.toLowerCase().includes(filterString.toLowerCase())),
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ingredient) => (
                      <tr key={ingredient.id}>
                        <td className={''}>
                          <div className="flex items-center space-x-3">
                            <div className="h-12 w-12">
                              {ingredient._count.IngredientImage == 0 ? (
                                <></>
                              ) : (
                                <AvatarImage src={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} alt={'Zutat'} />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={''}>{ingredient.name}</td>
                        <td>{ingredient.shortName}</td>
                        <td>
                          <button
                            className={'btn btn-ghost btn-sm flex flex-row items-center gap-2'}
                            onClick={() => {
                              modalContext.openModal(
                                <div className={'flex flex-col gap-2'}>
                                  <div className={'text-2xl font-bold'}>{ingredient.name}</div>
                                  <div className={'text-lg font-bold'}>Allgemeine Beschreibung</div>
                                  <div className={'whitespace-pre-wrap text-justify'}>{ingredient.description ?? '-'}</div>
                                  <div className={'text-lg font-bold'}>Notizen</div>
                                  <div className={'whitespace-pre-wrap text-justify'}>{ingredient.notes ?? '-'}</div>
                                </div>,
                              );
                            }}
                          >
                            <FaInfoCircle />
                            <span>Anzeigen</span>
                          </button>
                        </td>
                        <td className={'whitespace-nowrap'}>{ingredient.price ?? '-'} €</td>
                        <td className={'whitespace-nowrap'}>
                          {ingredient.volume} {ingredient.unit}
                        </td>
                        <td className={'whitespace-nowrap'}>{((ingredient.price ?? 0) / (ingredient.volume ?? 1)).toFixed(2)} €</td>
                        <td>
                          {ingredient.tags.map((tag) => (
                            <div key={`ingredient-${ingredient.id}-tags-${tag}`} className={'badge badge-primary badge-outline m-1'}>
                              {tag}
                            </div>
                          ))}
                        </td>
                        <td>
                          {ingredient.link
                            ?.replace('https://', '')
                            .replace('http://', '')
                            .replace('www.', '')
                            .substring(0, ingredient.link?.replace('https://', '').replace('http://', '').replace('www.', '').indexOf('/')) ?? ''}
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
