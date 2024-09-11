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
  showDescription?: boolean;
  showNotes?: boolean;
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
          <>
            {props.showNotes && props.cocktailRecipe.notes && (
              <>
                <div className={'border-b border-base-100'}></div>
                <div className={'font-bold'}>Notizen</div>
                <div className={'whitespace-pre-line text-pretty break-normal text-justify'}>{props.cocktailRecipe.notes}</div>
              </>
            )}
            {props.showDescription && props.cocktailRecipe.description && (
              <>
                <div className={'border-b border-base-100'}></div>
                <div className={'font-bold'}>Allgemeine Beschreibung</div>
                <div className={'whitespace-pre-line text-pretty break-normal text-justify'}>{props.cocktailRecipe.description}</div>
              </>
            )}

            <div className={'h-full'}></div>

            {props.showTags && props.cocktailRecipe.tags.length > 0 ? (
              <div className={''}>
                <div className={'mb-2 border-b border-base-100'}></div>
                {props.cocktailRecipe.tags.map((tag) => (
                  <span key={`cocktail-overview-item-${props.cocktailRecipe.id}-tag-${tag}`} className={'badge badge-primary badge-outline mr-1'}>
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
              </div>
            ) : (
              <></>
            )}
          </>
        </div>
      </div>
    </div>
  );
}
