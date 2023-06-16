import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailUtensil } from '../../models/CocktailUtensil';
import Link from 'next/link';
import { FaPencilAlt } from 'react-icons/fa';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useContext } from 'react';

interface CocktailDetailModalProps {
  cocktail: CocktailRecipeFull;
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const modalContext = useContext(ModalContext);

  return (
    <div className={''}>
      <div className={'card-body bg-base-100'}>
        <div className={'flex flex-row space-x-2'}>
          <Link href={'/manage/cocktails/' + props.cocktail.id}>
            <div
              className={'btn btn-sm btn-secondary btn-outline btn-square'}
              onClick={() => modalContext.closeModal()}
            >
              <FaPencilAlt />
            </div>
          </Link>
          <h2 className={'card-title flex-1'}>
            {props.cocktail.name} - <span className={'font-bold'}>{props.cocktail.price}€</span>
          </h2>
        </div>
        <div className={'grid grid-cols-2 gap-4'}>
          <div className={'col-span-2 flex'}>
            {props.cocktail.tags.map((tag, index) => (
              <div key={`cocktail-details-${props.cocktail.id}-tag-` + tag} className={'m-1 badge badge-primary'}>
                {tag}
              </div>
            ))}
          </div>
          <div className={'col-span-2 flex flex-row space-x-2'}>
            {props.cocktail.image != undefined ? (
              <img
                className={'flex-none rounded-lg shadow-md w-36 h-full object-cover object-center'}
                src={props.cocktail.image}
                alt={'Cocktail'}
              />
            ) : (
              <></>
            )}
            <div className={'form-control w-full'}>
              <label className={'label'}>
                <span className={'label-text'}>Beschreibung</span>
              </label>
              <textarea
                readOnly={true}
                value={props.cocktail.description ?? ''}
                className={'flex-1 w-full textarea textarea-bordered'}
              />
            </div>
          </div>
          <div className={'col-span-1'}>
            Glas: {props.cocktail.glass?.name}
            <img
              src={props.cocktail.glass?.image ?? '/images/glasses/default-glass.png'}
              alt={'Glas'}
              className={'w-16 h-16'}
            />
          </div>
          <div className={'col-span-1'}>Eis: {props.cocktail.glassWithIce}</div>
          <div className={'col-span-2 space-y-2'}>
            {props.cocktail.steps.length == 0 ? <></> : <div className={'font-bold text-2xl'}>Zubereitung</div>}
            <div className={'grid grid-cols-2 gap-4'}>
              {props.cocktail.steps.map((step, index) => (
                <div
                  key={'cocktail-details-step-' + step.id}
                  className={'col-span-2 border-2 border-base-300 rounded-lg p-2 space-y-2'}
                >
                  <span className={'font-bold text-xl'}>
                    {step.mixing ? (CocktailUtensil as any)[step.tool] : (CocktailUtensil as any)[step.tool]}
                  </span>
                  {step.ingredients.map((ingredient, index) => (
                    <div key={'cocktail-details-step-ingredient-' + ingredient.id} className={'pl-2'}>
                      <div className={'flex-1'}>
                        <div className={'flex flex-row space-x-2'}>
                          <div className={'font-bold'}>
                            {ingredient.amount}
                            {ingredient.unit}
                          </div>
                          <span>{ingredient.ingredient?.name}</span>
                          {ingredient.ingredient?.image != undefined ? (
                            <img src={ingredient.ingredient.image} alt={''} className={'object-cover h-16 avatar'} />
                          ) : (
                            <></>
                          )}
                        </div>
                      </div>
                      <div>
                        {ingredient.ingredient?.tags?.map((tag, index) => (
                          <div
                            key={`cocktail-details-${props.cocktail.id}-ingredients-${ingredient.id}-tags-${tag}`}
                            className={'m-1 badge badge-primary'}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {props.cocktail?.garnishes.length == 0 ? <></> : <div className={'font-bold text-2xl'}>Deko</div>}
            {props.cocktail?.garnishes
              .sort((a, b) => a.garnishNumber - b.garnishNumber)
              .map((garnish) => (
                <div
                  key={'cocktail-details-garnish-' + garnish.garnishNumber + '-' + garnish.garnish?.id}
                  className={'col-span-2 border-2 border-base-300 rounded-lg p-2 space-y-2 flex flex-col'}
                >
                  <div className={'font-bold text-xl'}>{garnish?.garnish?.name ?? 'Keine'}</div>
                  {garnish.description == undefined || garnish.description.trim() == '' ? (
                    <></>
                  ) : (
                    <div>{garnish.description}</div>
                  )}

                  {garnish?.garnish?.description == undefined && garnish?.garnish?.image == undefined ? (
                    <></>
                  ) : (
                    <>
                      <div className={'divider'}>Allgemeine Infos</div>

                      <div className={'flex flex-row'}>
                        {garnish?.garnish?.description != undefined ? (
                          <span className={'flex-1'}>{garnish?.garnish?.description}</span>
                        ) : (
                          <></>
                        )}
                        {garnish?.garnish?.image != undefined ? (
                          <img src={garnish.garnish?.image} alt={'Deko'} className={'object-cover h-16 avatar'} />
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
