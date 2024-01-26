import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import Link from 'next/link';
import { FaPencilAlt } from 'react-icons/fa';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useContext } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '../../lib/context/UserContextProvider';
import Image from 'next/image';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { $Enums, Role } from '@prisma/client';
import WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

interface CocktailDetailModalProps {
  cocktail: CocktailRecipeFull;
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

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
            {props.cocktail.name} - <span className={'font-bold'}>{props.cocktail.price}€</span>
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
            {props.cocktail.image != undefined ? (
              <img className={'h-full w-36 flex-none rounded-lg object-cover object-center shadow-md'} src={props.cocktail.image} alt={'Cocktail'} />
            ) : (
              <></>
            )}
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
              {props.cocktail.glass?.image != undefined ? (
                <Image src={props.cocktail.glass.image} alt={'Glas'} width={300} height={300} />
              ) : (
                <DefaultGlassIcon />
              )}
            </div>
          </div>
          <div className={'col-span-1'}>Eis: {props.cocktail.glassWithIce}</div>
          <div className={'col-span-2 space-y-2'}>
            {props.cocktail.steps.length == 0 ? <></> : <div className={'text-2xl font-bold'}>Zubereitung</div>}
            <div className={'grid grid-cols-2 gap-4'}>
              {props.cocktail.steps.map((step) => (
                <div key={'cocktail-details-step-' + step.id} className={'col-span-2 space-y-2 rounded-lg border-2 border-base-300 p-2'}>
                  <span className={'text-xl font-bold'}>
                    {JSON.parse(userContext.workspace?.WorkspaceSetting[WorkspaceSettingKey.translations] ?? '{}')?.['de'][step.action.name] ??
                      step.action.name}
                  </span>
                  {step.ingredients.map((ingredient) => (
                    <div key={'cocktail-details-step-ingredient-' + ingredient.id} className={'pl-2'}>
                      <div className={'flex-1'}>
                        <div className={'flex flex-row space-x-2'}>
                          <div className={'font-bold'}>
                            {ingredient.amount} {ingredient.unit}
                          </div>
                          <span>{ingredient.ingredient?.name}</span>
                          {ingredient.ingredient?.image != undefined ? (
                            <img src={ingredient.ingredient.image} alt={''} className={'avatar h-16 object-cover'} />
                          ) : (
                            <></>
                          )}
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
                  {garnish.description == undefined || garnish.description.trim() == '' ? <></> : <div>{garnish.description}</div>}

                  {garnish?.garnish?.description == undefined && garnish?.garnish?.image == undefined ? (
                    <></>
                  ) : (
                    <>
                      <div className={'divider'}>Allgemeine Infos</div>

                      <div className={'flex flex-row'}>
                        {garnish?.garnish?.description != undefined ? <span className={'flex-1'}>{garnish?.garnish?.description}</span> : <></>}
                        {garnish?.garnish?.image != undefined ? (
                          <img src={garnish.garnish?.image} alt={'Deko'} className={'avatar h-16 object-cover'} />
                        ) : (
                          <></>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
