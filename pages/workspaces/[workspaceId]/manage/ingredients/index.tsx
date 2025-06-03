import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '@components/Loading';
import { FaCheck, FaInfoCircle, FaPlus, FaTimes } from 'react-icons/fa';
import { ManageColumn } from '@components/ManageColumn';
import { UserContext } from '@lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import ListSearchField from '../../../../../components/ListSearchField';
import { IngredientModel } from '../../../../../models/IngredientModel';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { fetchIngredients } from '@lib/network/ingredients';
import ImageModal from '../../../../../components/modals/ImageModal';
import '../../../../../lib/NumberUtils';
import { NextPageWithPullToRefresh } from '../../../../../types/next';

const IngredientsOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterString, setFilterString] = useState('');

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  }, [workspaceId]);

  IngredientsOverviewPage.pullToRefresh = () => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  };

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
                  <th>Zutat</th>
                  <th>Eigene Bezeichnung</th>
                  <th>Notizen</th>
                  <th>Preis</th>
                  <th>Verfügbare Menge(n)</th>
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
                    <td colSpan={11}>
                      <Loading />
                    </td>
                  </tr>
                ) : ingredients.filter(
                    (ingredient) =>
                      ingredient.name.toLowerCase().includes(filterString.toLowerCase()) ||
                      ingredient.tags.some((tag) => tag.toLowerCase().includes(filterString.toLowerCase())),
                  ).length == 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center">
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
                        <td>
                          <div className="flex items-center space-x-3">
                            <div className="h-12 w-12">
                              {ingredient._count.IngredientImage == 0 ? (
                                <></>
                              ) : (
                                <div
                                  className="h-12 w-12 cursor-pointer"
                                  onClick={() =>
                                    modalContext.openModal(
                                      <ImageModal image={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} />,
                                    )
                                  }
                                >
                                  <AvatarImage src={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} alt={'Zutat'} />
                                </div>
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
                                  <div className={'mr-8 text-2xl font-bold'}>{ingredient.name}</div>
                                  <div className={'text-lg font-bold'}>Allgemeine Zutatenbeschreibung</div>
                                  <div className={'long-text-format'}>{ingredient.description ?? '-'}</div>
                                  <div className={'text-lg font-bold'}>Notizen</div>
                                  <div className={'long-text-format'}>{ingredient.notes ?? '-'}</div>
                                </div>,
                              );
                            }}
                          >
                            <FaInfoCircle />
                            <span>Anzeigen</span>
                          </button>
                        </td>
                        <td className={'whitespace-nowrap'}>{ingredient.price?.formatPrice() ?? '-'} €</td>
                        <td className={''}>
                          {ingredient.IngredientVolume.map((volume) => (
                            <div key={`ingredient-${ingredient.id}-volume-unit-${volume.id}`} className={'whitespace-nowrap'}>
                              {volume.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')} {userContext.getTranslation(volume.unit.name, 'de')}
                            </div>
                          ))}
                        </td>
                        <td>
                          {ingredient.IngredientVolume.map((volume) => (
                            <div key={`ingredient-${ingredient.id}-volume-unit-price-${volume.id}`} className={'whitespace-nowrap'}>
                              {((ingredient.price ?? 0) / volume.volume).formatPrice()} €/{userContext.getTranslation(volume.unit.name, 'de')}
                            </div>
                          ))}
                        </td>
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
                        <ManageColumn
                          entity={'ingredients'}
                          id={ingredient.id}
                          name={ingredient.name}
                          onRefresh={() => fetchIngredients(workspaceId, setIngredients, setLoading)}
                        />
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
};

export default IngredientsOverviewPage;
