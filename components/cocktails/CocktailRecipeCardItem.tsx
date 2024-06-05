import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useState } from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { FaPlus } from 'react-icons/fa';
import { MdPlaylistAdd } from 'react-icons/md';
import { addCocktailToQueue, addCocktailToStatistic } from '../../lib/network/cocktailTracking';

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
  showStatisticActions?: boolean;
  image?: string;
}

export default function CocktailRecipeCardItem(props: CocktailRecipeOverviewItemProps) {
  const router = useRouter();

  const [submittingStatistic, setSubmittingStatistic] = useState(false);
  const [submittingQueue, setSubmittingQueue] = useState(false);

  return (
    <div className={'col-span-1'}>
      <div className={'card card-side h-full'}>
        <ShowCocktailInfoButton showInfo={props.showInfo ?? false} cocktailRecipe={props.cocktailRecipe} />
        <div className={'card-body'}>
          <CompactCocktailRecipeInstruction
            specialPrice={props.specialPrice}
            showImage={props.showImage ?? false}
            showPrice={props.showPrice ?? true}
            cocktailRecipe={props.cocktailRecipe}
            image={props.image}
          />
          <div className={'h-full'}></div>
          <div className={'bottom-0'}>
            {props.showTags ? (
              props.cocktailRecipe.tags.map((tag) => (
                <span key={`cocktail-overview-item-${props.cocktailRecipe.id}-tag-${tag}`} className={'badge badge-primary badge-outline mr-1'}>
                  {tag}
                </span>
              ))
            ) : (
              <></>
            )}
            {props.showStatisticActions ? (
              <div className={'mt-1 flex flex-row gap-2'}>
                <button
                  className={'btn btn-outline flex-1'}
                  onClick={() =>
                    addCocktailToQueue({
                      workspaceId: router.query.workspaceId as string,
                      cocktailId: props.cocktailRecipe.id,
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
                      cocktailId: props.cocktailRecipe.id,
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
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
