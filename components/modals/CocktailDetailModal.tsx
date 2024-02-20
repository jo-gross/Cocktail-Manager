import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import Link from 'next/link';
import { FaPencilAlt, FaPlus } from 'react-icons/fa';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '../../lib/context/UserContextProvider';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { Role, WorkspaceSetting } from '@prisma/client';
import { WorkspaceSettingKey } from '.prisma/client';
import { alertService } from '../../lib/alertService';
import Image from 'next/image';
import AvatarImage from '../AvatarImage';
import { Loading } from '../Loading';

interface CocktailDetailModalProps {
  cocktailId: string;
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [loadedCocktail, setLoadedCocktail] = useState<CocktailRecipeFull>();

  const fetchCocktail = useCallback(async () => {
    if (!workspaceId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailId}`);
      if (response.ok) {
        const body = await response.json();
        setLoadedCocktail(body.data);
      } else {
        const body = await response.json();
        console.error('CocktailDetailModal -> fetchCocktail', response);
        alertService.error(body.message ?? 'Fehler beim Laden des Cocktails', response.status, response.statusText);
      }
    } catch (error) {
      console.error('CocktailDetailModal -> fetchCocktail', error);
      alertService.error('Fehler beim Laden des Cocktails');
    } finally {
      setLoading(false);
    }
  }, [props.cocktailId, workspaceId]);

  useEffect(() => {
    fetchCocktail();
  }, [fetchCocktail]);

  const [submittingStatistic, setSubmittingStatistic] = useState(false);
  const addCocktailToStatistic = useCallback(
    async (cocktailId: string) => {
      if (submittingStatistic) return;
      try {
        setSubmittingStatistic(true);
        const response = await fetch(`/api/workspaces/${router.query.workspaceId}/statistics/cocktails/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cocktailId: cocktailId,
            cocktailCardId: router.query.card,
            actionSource: router.query.card ? (router.query.card == 'search' ? 'SEARCH' : 'CARD') : undefined,
          }),
        });
        if (response.ok) {
          alertService.success('Cocktail zur Statistik hinzugefügt');
        } else {
          const body = await response.json();
          console.log('CocktailDetailModal -> addCocktailToStatistic', response);
          alertService.error(body.message ?? 'Fehler beim Hinzufügen des Cocktails zur Statistik', response.status, response.statusText);
        }
      } catch (error) {
        console.log('CocktailDetailModal -> addCocktailToStatistic', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      } finally {
        setSubmittingStatistic(false);
      }
    },
    [router.query.cocktailCardId, router.query.workspaceId, submittingStatistic],
  );

  return loading || loadedCocktail == undefined ? (
    <Loading />
  ) : (
    <div className={''}>
      <div className={'card-body bg-base-100'}>
        <div className={'flex flex-row space-x-2'}>
          <>
            {userContext.isUserPermitted(Role.MANAGER) && (
              <Link href={`/workspaces/${workspaceId}/manage/cocktails/${loadedCocktail.id}`}>
                <div className={'btn btn-square btn-outline btn-secondary btn-sm'} onClick={() => modalContext.closeModal()}>
                  <FaPencilAlt />
                </div>
              </Link>
            )}
          </>
          <h2 className={'card-title flex-1'}>
            {loadedCocktail.name} - <span className={'font-bold'}>{loadedCocktail.price}€</span>
          </h2>
        </div>
        <div className={'grid grid-cols-2 gap-4'}>
          <div className={'col-span-2 flex'}>
            {loadedCocktail.tags.map((tag) => (
              <div key={`cocktail-details-${loadedCocktail.id}-tag-` + tag} className={'badge badge-primary m-1'}>
                {tag}
              </div>
            ))}
          </div>
          <div className={'col-span-2 flex flex-row space-x-2'}>
            {loadedCocktail._count.CocktailRecipeImage == 0 ? (
              <></>
            ) : (
              <Image
                className={'h-full w-36 flex-none rounded-lg object-cover object-center shadow-md'}
                src={`/api/workspaces/${loadedCocktail.workspaceId}/cocktails/${loadedCocktail.id}/image`}
                alt={'Cocktail'}
                width={100}
                height={300}
              />
            )}

            <div className={'form-control w-full'}>
              <label className={'label'}>
                <span className={'label-text'}>Beschreibung</span>
              </label>
              <textarea readOnly={true} value={loadedCocktail.description ?? ''} className={'textarea textarea-bordered w-full flex-1'} />
            </div>
          </div>
          <div className={'col-span-1'}>
            Glas: {loadedCocktail.glass?.name}
            <div className={'h-16 w-16'}>
              {loadedCocktail.glass && loadedCocktail.glass._count.GlassImage != 0 ? (
                <Image src={`/api/workspaces/${loadedCocktail.workspaceId}/glasses/${loadedCocktail.glass.id}/image`} alt={'Glas'} width={300} height={300} />
              ) : (
                <DefaultGlassIcon />
              )}
            </div>
          </div>
          <div className={'col-span-1'}>Eis: {loadedCocktail.glassWithIce}</div>
          <div className={'col-span-2 space-y-2'}>
            {loadedCocktail.steps.length == 0 ? <></> : <div className={'text-2xl font-bold'}>Zubereitung</div>}
            <div className={'grid grid-cols-2 gap-4'}>
              {loadedCocktail.steps.map((step) => (
                <div key={'cocktail-details-step-' + step.id} className={'col-span-2 space-y-2 rounded-lg border-2 border-base-300 p-2'}>
                  <span className={'text-xl font-bold'}>
                    {JSON.parse(
                      (userContext.workspace?.WorkspaceSetting as WorkspaceSetting[]).find((setting) => setting.setting == WorkspaceSettingKey.translations)
                        ?.value ?? '{}',
                    )['de'][step.action?.name] ?? step.action?.name}
                  </span>
                  {step.ingredients.map((ingredient) => (
                    <div key={'cocktail-details-step-ingredient-' + ingredient.id} className={'pl-2'}>
                      <div className={'flex-1'}>
                        <div className={'flex flex-row items-center space-x-2'}>
                          <div className={'h-12 w-12'}>
                            {ingredient.ingredient?._count?.IngredientImage != 0 ? (
                              <AvatarImage
                                src={`/api/workspaces/${loadedCocktail.workspaceId}/ingredients/${ingredient.ingredient?.id}/image`}
                                alt={`Cocktail Zutat ${ingredient.ingredient?.name}`}
                              />
                            ) : (
                              <></>
                            )}
                          </div>
                          <div className={'font-bold'}>
                            {ingredient.amount} {ingredient.unit}
                          </div>
                          <span>{ingredient.ingredient?.name}</span>
                        </div>
                      </div>
                      <div>
                        {ingredient.ingredient?.tags?.map((tag) => (
                          <div key={`cocktail-details-${loadedCocktail.id}-ingredients-${ingredient.id}-tags-${tag}`} className={'badge badge-primary m-1'}>
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {loadedCocktail?.garnishes.length == 0 ? <></> : <div className={'text-2xl font-bold'}>Deko</div>}
            {loadedCocktail?.garnishes
              .sort((a, b) => a.garnishNumber - b.garnishNumber)
              .map((garnish) => (
                <div
                  key={'cocktail-details-garnish-' + garnish.garnishNumber + '-' + garnish.garnish?.id}
                  className={'col-span-2 flex flex-col space-y-2 rounded-lg border-2 border-base-300 p-2'}
                >
                  <div className={'text-xl font-bold'}>{garnish?.garnish?.name ?? 'Keine'}</div>
                  <div className={'flex flex-row items-center'}>
                    {garnish.garnish._count.GarnishImage == 0 ? (
                      <></>
                    ) : (
                      <div className={'h-12 w-12'}>
                        <AvatarImage
                          alt={'Cocktail Garnitur ' + garnish.garnish?.name}
                          src={`/api/workspaces/${garnish.garnish.workspaceId}/garnishes/${garnish.garnish.id}/image`}
                        />
                      </div>
                    )}
                    {garnish.description == undefined || garnish.description.trim() == '' ? <></> : <div>{garnish.description}</div>}
                  </div>
                  {garnish?.garnish?.description == undefined ? (
                    <></>
                  ) : (
                    <>
                      <div className={'divider'}>Allgemeine Infos</div>

                      <div className={'flex flex-row'}>
                        <span className={'flex-1'}>{garnish?.garnish?.description}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
          <div className={'col-span-2'}>
            <button className={'btn btn-outline btn-primary w-full'} onClick={() => addCocktailToStatistic(loadedCocktail.id)} disabled={submittingStatistic}>
              <FaPlus />
              Gemacht
              {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
