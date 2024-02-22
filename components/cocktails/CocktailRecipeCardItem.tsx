import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useCallback, useState } from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { alertService } from '../../lib/alertService';
import { FaPlus } from 'react-icons/fa';

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

  const addCocktailToStatistic = useCallback(async () => {
    if (submittingStatistic) return;
    try {
      setSubmittingStatistic(true);
      const response = await fetch(`/api/workspaces/${router.query.workspaceId}/statistics/cocktails/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cocktailId: props.cocktailRecipe.id,
          cocktailCardId: router.query.card,
          actionSource: router.query.card ? (router.query.card == 'search' ? 'SEARCH' : 'CARD') : undefined,
        }),
      });
      if (response.ok) {
        alertService.success('Cocktail zur Statistik hinzugefügt');
      } else {
        const body = await response.json();
        console.error('CocktailRecipeCardItem -> addCocktailToStatistic', response);
        alertService.error(body.message ?? 'Fehler beim Hinzufügen des Cocktails zur Statistik', response.status, response.statusText);
      }
    } catch (error) {
      console.error('CocktailRecipeCardItem -> addCocktailToStatistic', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setSubmittingStatistic(false);
    }
  }, [props.cocktailRecipe.id, router.query.cocktailCardId, router.query.workspaceId, submittingStatistic]);

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
              <button className={'btn btn-outline btn-primary w-full'} onClick={addCocktailToStatistic} disabled={submittingStatistic}>
                <FaPlus />
                Gemacht
                {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
              </button>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
