import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import Link from 'next/link';
import { FaArrowLeft, FaFileDownload, FaInfo, FaPencilAlt, FaPlus, FaSyncAlt, FaTimes } from 'react-icons/fa';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '../../lib/context/UserContextProvider';
import { CocktailRating, Role } from '@prisma/client';
import Image from 'next/image';
import AvatarImage from '../AvatarImage';
import { Loading } from '../Loading';
import ImageModal from './ImageModal';
import { calcCocktailTotalPrice } from '../../lib/CocktailRecipeCalculation';
import { fetchIngredients } from '../../lib/network/ingredients';
import { IngredientModel } from '../../models/IngredientModel';
import AddCocktailRatingModal from './AddCocktailRatingModal';
import CocktailRatingsModal from './CocktailRatingsModal';
import StarsComponent from '../StarsComponent';
import { fetchCocktailRatings } from '../../lib/network/cocktailRatings';
import { fetchCocktail } from '../../lib/network/cocktails';
import StatisticActions from '../StatisticActions';

interface CocktailDetailModalProps {
  cocktailId: string;

  onRefreshRatings: () => void;
  queueNotes?: string;
  queueAmount?: number;
  openReferer: 'QUEUE' | 'DETAIL';
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [loadedCocktail, setLoadedCocktail] = useState<CocktailRecipeFull>();

  const [ingredients, setIngredients] = useState<IngredientModel[] | undefined>(undefined);

  const [cocktailRatings, setCocktailRatings] = useState<CocktailRating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [ratingError, setRatingsError] = useState(false);

  const [localQueueAmount, setLocalQueueAmount] = useState(props.queueAmount);

  const refreshRatings = useCallback(() => {
    props.onRefreshRatings();
    fetchCocktailRatings(workspaceId, props.cocktailId, setCocktailRatings, setRatingsLoading, setRatingsError);
  }, [props, workspaceId]);

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, () => {});
    fetchCocktail(workspaceId, props.cocktailId, setLoadedCocktail, setLoading);
    fetchCocktailRatings(workspaceId, props.cocktailId, setCocktailRatings, setRatingsLoading, setRatingsError);
  }, [props.cocktailId, workspaceId]);

  return loading || loadedCocktail == undefined ? (
    <Loading />
  ) : (
    <>
      <div className={'md:max-w-5xl'}>
        <div className={'card-body bg-base-100'}>
          <div className={'w-full pb-4 text-center text-2xl font-bold no-print:hidden'}>{loadedCocktail.name}</div>
          <div className={'flex flex-row space-x-2 print:hidden'}>
            {modalContext.content.length > 1 && (
              <button className={'btn btn-square btn-outline btn-sm'} onClick={() => modalContext.closeModal()}>
                <FaArrowLeft />
              </button>
            )}
            <h2 className={'card-title flex-1'}>
              {loadedCocktail.name}
              {loadedCocktail.price != undefined ? (
                <>
                  {' - '}
                  <span className={'font-bold'}>{loadedCocktail.price + ' €'}</span>
                </>
              ) : (
                <></>
              )}
            </h2>
            <button
              className={'btn btn-square btn-outline btn-sm'}
              onClick={() => {
                window.print();
              }}
            >
              <FaFileDownload />
            </button>
            <>
              {userContext.isUserPermitted(Role.MANAGER) && (
                <Link href={`/workspaces/${workspaceId}/manage/cocktails/${loadedCocktail.id}`}>
                  <div className={'btn btn-square btn-outline btn-secondary btn-sm'} onClick={() => modalContext.closeAllModals()}>
                    <FaPencilAlt />
                  </div>
                </Link>
              )}
            </>
            <button className={'btn btn-square btn-outline btn-sm'} onClick={() => modalContext.closeAllModals()}>
              <FaTimes />
            </button>
          </div>
          {(props.queueNotes || localQueueAmount) && (
            <div className={'alert alert-warning grid grid-cols-2'}>
              {localQueueAmount && (
                <div>
                  Anzahl: <strong>{localQueueAmount}x</strong>
                </div>
              )}
              {props.queueNotes && (
                <div>
                  Warteschlangennotiz: <strong>{props.queueNotes}</strong>
                </div>
              )}
            </div>
          )}
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-2'}>
            {/*Left side*/}
            <div className={'flex flex-col gap-2'}>
              <div className={'flex flex-row justify-between gap-2 rounded border border-base-300 p-2'}>
                <div className={'flex flex-1 flex-col gap-2'}>
                  {(loadedCocktail?.tags.length ?? 0) > 0 && (
                    <div className={'gap-2'}>
                      {loadedCocktail?.tags.map((tag) => (
                        <div key={`cocktail-details-${loadedCocktail.id}-tags-${tag}`} className={'badge badge-primary mr-1'}>
                          {tag}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={'flex flex-1 items-end justify-between gap-2'}>
                    <div>Glas: {loadedCocktail.glass?.name}</div>
                    <div>Eis: {userContext.getTranslation(loadedCocktail.ice?.name ?? '-', 'de')}</div>
                  </div>
                </div>
                {loadedCocktail.glass && loadedCocktail.glass._count.GlassImage > 0 && (
                  <div className={''}>
                    <div className={'h-16 w-16'}>
                      <AvatarImage
                        src={`/api/workspaces/${loadedCocktail.workspaceId}/glasses/${loadedCocktail.glass.id}/image`}
                        onClick={() =>
                          modalContext.openModal(
                            <ImageModal image={`/api/workspaces/${loadedCocktail.workspaceId}/glasses/${loadedCocktail.glass?.id}/image`} />,
                          )
                        }
                        alt={`Glas - ${loadedCocktail.glass?.name}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={`grid ${loadedCocktail._count.CocktailRecipeImage > 0 ? 'grid-cols-5' : 'grid-cols-3'} gap-2`}>
                <div className={'col-span-3 flex flex-col gap-2'}>
                  <div className={'font-bold'}>Zubereitung</div>
                  {loadedCocktail.steps
                    .sort((a, b) => a.stepNumber - b.stepNumber)
                    .map((step) => (
                      <div key={`cocktail-details-step-${step.id}`} className={'flex flex-col gap-2 rounded border border-base-300 p-2'}>
                        <div className={`font-bold ${step.optional ? 'italic' : ''}`}>
                          {userContext.getTranslation(step.action.name, 'de')} {step.optional && '(optional)'}
                        </div>
                        {step.ingredients
                          .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                          .map((stepIngredient) => (
                            <div
                              key={`cocktail-details-step-ingredient-${stepIngredient.id}`}
                              className={`flex flex-row gap-2 pl-3 ${stepIngredient.optional ? 'italic' : ''}`}
                            >
                              <div className={'font-bold'}>{stepIngredient.amount}</div>
                              <div className={'font-bold'}>{userContext.getTranslation(stepIngredient.unit?.name ?? '', 'de')}</div>
                              <div>{stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name}</div>
                              {stepIngredient.optional && <div>(optional)</div>}
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
                {loadedCocktail._count.CocktailRecipeImage > 0 && (
                  <div className={'col-span-2'}>
                    <Image
                      className={'h-full w-full flex-none cursor-pointer rounded-lg object-cover object-center shadow-md'}
                      src={`/api/workspaces/${loadedCocktail.workspaceId}/cocktails/${loadedCocktail.id}/image`}
                      alt={'Cocktail'}
                      onClick={() =>
                        modalContext.openModal(<ImageModal image={`/api/workspaces/${loadedCocktail.workspaceId}/cocktails/${loadedCocktail.id}/image`} />)
                      }
                      width={100}
                      height={300}
                    />
                  </div>
                )}
              </div>
              {loadedCocktail.garnishes.length > 0 && (
                <>
                  <div className={'font-bold'}>Garnitur</div>
                  {loadedCocktail.garnishes
                    .sort((a, b) => a.garnishNumber - b.garnishNumber)
                    .map((garnish) => (
                      <div
                        key={`cocktail-details-garnish-${garnish.garnishNumber}-${garnish.garnish?.id}`}
                        className={'flex flex-col gap-2 rounded border border-base-300 p-2'}
                      >
                        <div className={'flex flex-row justify-between gap-2'}>
                          <div className={`font-bold ${garnish.optional ? 'italic' : ''}`}>
                            {garnish.garnish.name} {garnish.optional ? '(Optional)' : ''}
                          </div>
                        </div>
                        {garnish.description && (
                          <>
                            <div className={'underline'}>Cocktailspezifische-Notizen</div>
                            <div className={'long-text-format'}>{garnish.description}</div>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}

              <div className={'divider-sm print:hidden'}></div>
              <div className={'print:hidden'}>
                <StatisticActions
                  workspaceId={router.query.workspaceId as string}
                  cocktailId={loadedCocktail.id}
                  cocktailName={loadedCocktail.name}
                  actionSource={'DETAIL_MODAL'}
                  notes={props.queueNotes}
                  onMarkedAsDone={
                    props.openReferer === 'QUEUE'
                      ? () => {
                          if (localQueueAmount === 1) {
                            modalContext.closeAllModals();
                          } else {
                            setLocalQueueAmount((prev) => (prev ?? 0) - 1);
                          }
                        }
                      : undefined
                  }
                />
              </div>
            </div>
            {/*Right side*/}
            <div className={'flex flex-col gap-2'}>
              <div className={'w-full gap-2'}>
                <span className={'font-bold'}>Bewertung</span>
                <div className={'flex flex-row items-center gap-2'}>
                  {ratingError ? (
                    <>
                      <div>Fehler beim Laden der Bewertungen</div>
                      <button type={'button'} className={`btn btn-square btn-outline btn-sm`} disabled={ratingsLoading} onClick={refreshRatings}>
                        {ratingsLoading && <span className="loading loading-spinner"></span>}
                        <FaSyncAlt />
                      </button>
                    </>
                  ) : (
                    <>
                      {ratingsLoading ? (
                        <Loading />
                      ) : (cocktailRatings ?? []).length > 0 ? (
                        (cocktailRatings.reduce((acc, rating) => acc + rating.rating, 0) / cocktailRatings.length).toFixed(1)
                      ) : (
                        'Keine Bewertungen'
                      )}
                      <StarsComponent
                        rating={cocktailRatings.length > 0 ? cocktailRatings.reduce((acc, rating) => acc + rating.rating, 0) / cocktailRatings.length : 0}
                      />
                      ({cocktailRatings.length})
                      {cocktailRatings.length != 0 ? (
                        <button
                          type={'button'}
                          className={'btn btn-square btn-outline btn-info btn-sm print:hidden'}
                          disabled={cocktailRatings.length === 0}
                          onClick={() =>
                            modalContext.openModal(
                              <CocktailRatingsModal cocktailId={loadedCocktail.id} cocktailName={loadedCocktail.name} onUpdate={refreshRatings} />,
                            )
                          }
                        >
                          <FaInfo />
                        </button>
                      ) : (
                        <></>
                      )}
                      <div className={'flex-grow'}></div>
                      <button
                        type={'button'}
                        className={'btn btn-outline btn-sm print:hidden'}
                        onClick={() => modalContext.openModal(<AddCocktailRatingModal cocktailId={props.cocktailId} onCreated={refreshRatings} />)}
                      >
                        <FaPlus /> Bewertung hinzufügen
                      </button>
                    </>
                  )}
                </div>
              </div>

              {loadedCocktail.notes && (
                <>
                  <div className={'font-bold'}>Zubereitungsnotizen</div>
                  <div className={'long-text-format rounded border border-base-300 p-2'}>{loadedCocktail.notes}</div>
                </>
              )}
              {loadedCocktail.description && (
                <>
                  <div className={'font-bold'}>Allgemeine Beschreibung</div>
                  <div className={'long-text-format rounded border border-base-300 p-2 text-justify'}>{loadedCocktail.description}</div>
                </>
              )}
              {loadedCocktail.history && (
                <>
                  <div className={'font-bold'}>Geschichte und Entstehung</div>
                  <div className={'long-text-format rounded border border-base-300 p-2 text-justify'}>{loadedCocktail.history}</div>
                </>
              )}
              {loadedCocktail.steps.map((step) => step.ingredients).flat().length > 0 && (
                <>
                  <div className={'font-bold'}>Zutatenbeschreibungen</div>
                  {loadedCocktail.steps
                    .map((step) => step.ingredients)
                    .flat()
                    .sort((a, b) => (a.ingredient?.name ?? '').localeCompare(b.ingredient?.name ?? ''))
                    .map((ingredient) => (
                      <div
                        key={`cocktail-details-${loadedCocktail.id}-ingredients-${ingredient.id}`}
                        className={'flex flex-col gap-2 rounded border border-base-300 p-2'}
                      >
                        <div className={'flex flex-row items-center justify-between gap-2'}>
                          <div className={'flex flex-col gap-2'}>
                            <div className={'font-bold'}>{ingredient.ingredient?.name}</div>
                            {ingredient.ingredient?.shortName && <div className={'text-sm font-thin italic'}>{ingredient.ingredient?.shortName}</div>}
                          </div>
                          <div>
                            {ingredient.ingredient?._count?.IngredientImage != 0 ? (
                              <div className={'h-16 w-16'}>
                                <AvatarImage
                                  src={`/api/workspaces/${loadedCocktail.workspaceId}/ingredients/${ingredient.ingredient?.id}/image`}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <ImageModal image={`/api/workspaces/${loadedCocktail.workspaceId}/ingredients/${ingredient.ingredient?.id}/image`} />,
                                    )
                                  }
                                  alt={`Zutat Produktbild - ${ingredient.ingredient?.name}`}
                                />
                              </div>
                            ) : (
                              <></>
                            )}
                          </div>
                        </div>
                        {ingredient.ingredient?.description && (
                          <div className={'text-justify'}>
                            <div className={'underline'}>Zutat Beschreibung</div>
                            <div className={'long-text-format'}>{ingredient.ingredient?.description}</div>
                          </div>
                        )}
                        {ingredient.ingredient?.notes && (
                          <div className={'text-justify'}>
                            <div className={'underline'}>Notizen</div>
                            <div className={'long-text-format'}>{ingredient.ingredient?.notes}</div>
                          </div>
                        )}
                        {(ingredient.ingredient?.tags.length ?? 0) > 0 && (
                          <div className={'gap-2'}>
                            {ingredient.ingredient?.tags.map((tag) => (
                              <div
                                key={`cocktail-details-${loadedCocktail.id}-ingredients-${ingredient.id}-tags-${tag}`}
                                className={'badge badge-primary mr-1 print:badge-outline'}
                              >
                                {tag}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              )}
              {loadedCocktail.garnishes.length > 0 && (
                <>
                  <div className={'font-bold'}>Garniturbeschreibungen</div>
                  {loadedCocktail.garnishes
                    .map((garnish) => garnish.garnish)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                    .map((garnish, index) => (
                      <div key={`cocktail-details-garnish-${index}-${garnish?.id}`} className={'flex flex-col gap-2 rounded border border-base-300 p-2'}>
                        <div className={'flex flex-row justify-between gap-2'}>
                          <div className={`font-bold`}>{garnish.name}</div>
                          {garnish._count.GarnishImage > 0 && (
                            <div className={'h-12 w-12'}>
                              <AvatarImage
                                src={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`}
                                alt={'Cocktail Garnitur ' + garnish?.name}
                                onClick={() =>
                                  modalContext.openModal(<ImageModal image={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} />)
                                }
                              />
                            </div>
                          )}
                        </div>
                        {garnish.description && (
                          <>
                            <div className={'underline'}>Allgemeine Beschreibung</div>
                            <div className={'long-text-format'}>{garnish.description}</div>
                          </>
                        )}
                        {garnish.notes && (
                          <>
                            <div className={'underline'}>Notizen</div>
                            <div className={'long-text-format'}>{garnish.notes}</div>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}

              <div className={'flex-grow'}></div>
              {userContext.isUserPermitted(Role.MANAGER) && ingredients && (
                <>
                  <div className={'font-bold'}>Materialkosten</div>
                  <div>{calcCocktailTotalPrice(loadedCocktail, ingredients).toFixed(2) + ' €'}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
