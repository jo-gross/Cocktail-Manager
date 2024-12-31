import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import { MdPlaylistAdd } from 'react-icons/md';
import { addCocktailToQueue, addCocktailToStatistic } from '../../lib/network/cocktailTracking';
import { Loading } from '../Loading';
import { fetchCocktail } from '../../lib/network/cocktails';
import { CocktailRating } from '@prisma/client';
import { fetchCocktailRatings } from '../../lib/network/cocktailRatings';

export type CocktailRecipeOverviewItemRef = {
  refresh: () => void;
};

export type CocktailRecipeOverviewItemProps = {
  cocktailRecipe: CocktailRecipeFull | string;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
  showDescription?: boolean;
  showNotes?: boolean;
  showHistory?: boolean;
  showStatisticActions?: boolean;
  image?: string;
  showRating?: boolean;
};

const CocktailRecipeCardItem = forwardRef<CocktailRecipeOverviewItemRef, CocktailRecipeOverviewItemProps>((props, ref) => {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;

  const [submittingStatistic, setSubmittingStatistic] = useState(false);
  const [submittingQueue, setSubmittingQueue] = useState(false);

  const [loadedCocktailRecipe, setLoadedCocktailRecipe] = useState<CocktailRecipeFull | undefined>(
    typeof props.cocktailRecipe === 'string' ? undefined : props.cocktailRecipe,
  );
  const [cocktailRecipeLoading, setCocktailRecipeLoading] = useState(false);

  const [cocktailRatings, setCocktailRatings] = useState<CocktailRating[]>([]);
  const [cocktailRatingsLoading, setCocktailRatingsLoading] = useState(false);
  const [cocktailRatingsError, setCocktailRatingsError] = useState<boolean>(false);

  const refresh = useCallback(() => {
    if (typeof props.cocktailRecipe === 'string') {
      fetchCocktail(workspaceId, props.cocktailRecipe, setLoadedCocktailRecipe, setCocktailRecipeLoading);
      fetchCocktailRatings(workspaceId, props.cocktailRecipe, setCocktailRatings, setCocktailRatingsLoading, setCocktailRatingsError);
    }
  }, [workspaceId, props.cocktailRecipe]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useImperativeHandle(ref, () => ({
    refresh,
  }));

  const cocktailRecipe = typeof props.cocktailRecipe === 'string' ? loadedCocktailRecipe : props.cocktailRecipe;

  return (
    <div className={'col-span-1'}>
      <div className={'card card-side h-full'}>
        {cocktailRecipeLoading ? (
          <div className={'flex h-full min-h-40 w-full flex-col items-center justify-center gap-2'}>
            <Loading />
            <div>Lade Cocktail...</div>
          </div>
        ) : cocktailRecipe ? (
          <>
            <ShowCocktailInfoButton
              showInfo={props.showInfo ?? false}
              cocktailId={cocktailRecipe.id}
              onRatingChange={() =>
                fetchCocktailRatings(workspaceId, cocktailRecipe.id, setCocktailRatings, setCocktailRatingsLoading, setCocktailRatingsError)
              }
            />
            <div className={'card-body'}>
              <CompactCocktailRecipeInstruction
                cocktailRecipe={cocktailRecipe}
                specialPrice={props.specialPrice}
                showImage={props.showImage ?? false}
                showPrice={props.showPrice ?? true}
                image={props.image}
                showRating={props.showRating ? { ratings: cocktailRatings, loading: cocktailRatingsLoading, error: cocktailRatingsError } : undefined}
              />
              <>
                {props.showNotes && cocktailRecipe.notes && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>Zubereitungsnotizen</div>
                    <div className={'long-text-format'}>{cocktailRecipe.notes}</div>
                  </>
                )}
                {props.showDescription && cocktailRecipe.description && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>Allgemeine Beschreibung</div>
                    <div className={'long-text-format'}>{cocktailRecipe.description}</div>
                  </>
                )}
                {props.showHistory && cocktailRecipe.history && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>Geschichte und Entstehung</div>
                    <div className={'long-text-format'}>{cocktailRecipe.history}</div>
                  </>
                )}

                <div className={'h-full'}></div>

                {props.showTags && cocktailRecipe.tags.length > 0 ? (
                  <div className={''}>
                    <div className={'mb-2 border-b border-base-100'}></div>
                    {cocktailRecipe.tags.map((tag) => (
                      <span key={`cocktail-overview-item-${cocktailRecipe.id}-tag-${tag}`} className={'badge badge-primary badge-outline mr-1'}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <></>
                )}

                {props.showStatisticActions ? (
                  <div className={''}>
                    <div className={'mt-1 flex flex-row gap-2'}>
                      <button
                        className={'btn btn-outline flex-1'}
                        onClick={() =>
                          addCocktailToQueue({
                            workspaceId: router.query.workspaceId as string,
                            cocktailId: cocktailRecipe.id,
                            setSubmitting: setSubmittingQueue,
                          })
                        }
                        disabled={submittingQueue}
                      >
                        <MdPlaylistAdd />
                        Liste
                        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
                      </button>
                      <button
                        className={'btn btn-outline btn-primary flex-1'}
                        onClick={() =>
                          addCocktailToStatistic({
                            workspaceId: router.query.workspaceId as string,
                            cocktailId: cocktailRecipe.id,
                            cardId: router.query.cardId,
                            actionSource: 'CARD',
                            setSubmitting: setSubmittingStatistic,
                          })
                        }
                        disabled={submittingStatistic}
                      >
                        <FaPlus />
                        Gemacht
                        {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <></>
                )}
              </>
            </div>
          </>
        ) : (
          <div className={'flex h-full min-h-40 w-full flex-col items-center justify-center gap-2'}>
            <FaExclamationTriangle />
            <div>Fehler beim Laden des Cocktails</div>
          </div>
        )}
      </div>
    </div>
  );
});

export default CocktailRecipeCardItem;
CocktailRecipeCardItem.displayName = 'CocktailRecipeCardItem';
