import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import Link from 'next/link';
import { FaPencilAlt, FaPlus } from 'react-icons/fa';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import React, { useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '../../lib/context/UserContextProvider';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { Role, WorkspaceSetting } from '@prisma/client';
import { WorkspaceSettingKey } from '.prisma/client';
import CustomImage from '../CustomImage';
import NextImage from '../NextImage';
import { alertService } from '../../lib/alertService';

interface CocktailDetailModalProps {
  cocktail: CocktailRecipeFull;
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

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

  return (
    <div className={''}>
      <div className={'card-body bg-base-100'}>
        <div className={'flex flex-row space-x-2'}>
          <>
            {userContext.isUserPermitted(Role.MANAGER) && (
              <Link href={`/workspaces/${workspaceId}/manage/cocktails/${props.cocktail.id}`}>
                <div className={'btn btn-square btn-outline btn-secondary btn-sm'} onClick={() => modalContext.closeModal()}>
                  <FaPencilAlt />
                </div>
              </Link>
            )}
          </>
          <h2 className={'card-title flex-1'}>
            {props.cocktail.name}
            {props.cocktail.price != undefined ? (
              <>
                {' - '}
                <span className={'font-bold'}>{props.cocktail.price + ' €'}</span>
              </>
            ) : (
              <></>
            )}
          </h2>
        </div>
        <div className={'grid grid-cols-2 gap-4'}>
          <div className={'col-span-2 flex'}>
            {props.cocktail.tags.map((tag) => (
              <div key={`cocktail-details-${props.cocktail.id}-tag-` + tag} className={'badge badge-primary m-1'}>
                {tag}
              </div>
            ))}
          </div>
          <div className={'col-span-2 flex flex-row space-x-2'}>
            <CustomImage
              className={'h-full w-36 flex-none rounded-lg object-cover object-center shadow-md'}
              src={`/api/workspaces/${props.cocktail.workspaceId}/cocktails/${props.cocktail.id}/image`}
              alt={'Cocktail'}
              altComponent={<></>}
            />

            <div className={'form-control w-full'}>
              <label className={'label'}>
                <span className={'label-text'}>Beschreibung</span>
              </label>
              <textarea readOnly={true} value={props.cocktail.description ?? ''} className={'textarea textarea-bordered w-full flex-1'} />
            </div>
          </div>
          <div className={'col-span-1'}>
            Glas: {props.cocktail.glass?.name}
            <div className={'h-16 w-16'}>
              <NextImage
                src={`/api/workspaces/${props.cocktail.workspaceId}/glasses/${props.cocktail.glass?.id}/image`}
                alt={'Glas'}
                width={300}
                height={300}
                altComponent={<DefaultGlassIcon />}
              />
            </div>
          </div>
          <div className={'col-span-1'}>Eis: {props.cocktail.glassWithIce}</div>
          <div className={'col-span-2 space-y-2'}>
            {props.cocktail.steps.length == 0 ? <></> : <div className={'text-2xl font-bold'}>Zubereitung</div>}
            <div className={'grid grid-cols-2 gap-4'}>
              {props.cocktail.steps.map((step) => (
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
                        <div className={'flex flex-row space-x-2'}>
                          <div className={'font-bold'}>
                            {ingredient.amount} {ingredient.unit}
                          </div>
                          <span>{ingredient.ingredient?.name}</span>
                          <CustomImage
                            src={`/api/workspaces/${props.cocktail.workspaceId}/ingredients/${ingredient.ingredient?.id}/image`}
                            altComponent={<></>}
                            className={'h-16 rounded-full object-cover'}
                            alt={''}
                          />
                        </div>
                      </div>
                      <div>
                        {ingredient.ingredient?.tags?.map((tag) => (
                          <div key={`cocktail-details-${props.cocktail.id}-ingredients-${ingredient.id}-tags-${tag}`} className={'badge badge-primary m-1'}>
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {props.cocktail?.garnishes.length == 0 ? <></> : <div className={'text-2xl font-bold'}>Deko</div>}
            {props.cocktail?.garnishes
              .sort((a, b) => a.garnishNumber - b.garnishNumber)
              .map((garnish) => (
                <div
                  key={'cocktail-details-garnish-' + garnish.garnishNumber + '-' + garnish.garnish?.id}
                  className={'col-span-2 flex flex-col space-y-2 rounded-lg border-2 border-base-300 p-2'}
                >
                  <div className={'text-xl font-bold'}>{garnish?.garnish?.name ?? 'Keine'}</div>
                  <div className={'flex flex-row items-center'}>
                    <CustomImage
                      alt={'Deko'}
                      className={'avatar h-16 object-contain'}
                      src={`/api/workspaces/${garnish.garnish.workspaceId}/garnishes/${garnish.garnish.id}/image`}
                    />
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
            <button className={'btn btn-outline btn-primary w-full'} onClick={() => addCocktailToStatistic(props.cocktail.id)} disabled={submittingStatistic}>
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
