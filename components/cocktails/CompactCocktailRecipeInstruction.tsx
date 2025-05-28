import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import Image from 'next/image';
import { ModalContext } from '@lib/context/ModalContextProvider';
import ImageModal from '../modals/ImageModal';
import { Loading } from '../Loading';
import StarsComponent from '../StarsComponent';
import { CocktailRating } from '@generated/prisma/client';

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
  showImage?: boolean;
  image?: string;

  showRating?: { ratings: CocktailRating[]; loading: boolean; error: boolean };
}

export function CompactCocktailRecipeInstruction(props: CompactCocktailRecipeInstructionProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  return (
    <div className={'grid grid-cols-4 gap-1'}>
      <div className={`${props.showPrice ? 'col-span-2' : 'col-span-3'} text-xl font-bold`}>
        {props.cocktailRecipe.name == '' ? '<Name>' : props.cocktailRecipe.name}
      </div>
      {props.showPrice == true ? (
        <div className={'col-span-1 text-right text-xl font-bold'}>
          {(props.specialPrice ?? props.cocktailRecipe.price) != undefined
            ? (props.specialPrice?.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }) ??
              props.cocktailRecipe.price?.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }) + ' €')
            : ''}
        </div>
      ) : (
        <></>
      )}
      {props.cocktailRecipe.glass && props.cocktailRecipe.glass._count.GlassImage != 0 && (
        <div className={`${props.showRating ? 'row-span-3' : 'row-span-2'} flex h-full items-center justify-center`}>
          <Image
            className={'h-16 w-fit cursor-pointer rounded-lg object-contain'}
            src={`/api/workspaces/${props.cocktailRecipe.workspaceId}/glasses/${props.cocktailRecipe.glass?.id}/image`}
            alt={props.cocktailRecipe.glass?.name ?? 'Cocktail-Glas'}
            onClick={() =>
              modalContext.openModal(
                <ImageModal image={`/api/workspaces/${props.cocktailRecipe.workspaceId}/glasses/${props.cocktailRecipe.glass?.id}/image`} />,
              )
            }
            width={200}
            height={200}
          />
        </div>
      )}
      {props.showRating && (
        <div className={'col-span-3 flex flex-row items-center gap-2'}>
          {props.showRating.error ? (
            <>
              <div>Fehler beim Laden der Bewertungen</div>
            </>
          ) : (
            <>
              {props.showRating.loading ? (
                <Loading />
              ) : (
                <>
                  {(props.showRating.ratings.length > 0
                    ? props.showRating.ratings.reduce((acc, rating) => acc + rating.rating, 0) / props.showRating.ratings.length
                    : 0
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <StarsComponent
                    rating={
                      props.showRating.ratings.length > 0
                        ? props.showRating.ratings.reduce((acc, rating) => acc + rating.rating, 0) / props.showRating.ratings.length
                        : 0
                    }
                  />
                  ({props.showRating.ratings.length})
                </>
              )}
            </>
          )}
        </div>
      )}
      <div className={'col-span-3 flex flex-row justify-between space-x-2 font-thin'}>
        <div>Glas: {props.cocktailRecipe.glass?.name ?? '<Glas>'}</div>
        <div>Eis: {userContext.getTranslation(props.cocktailRecipe.ice?.name ?? '<Eis>', 'de')}</div>
      </div>
      <div className={'border-base-100 col-span-4 border-b'}></div>
      <div className={`col-span-4 grid grid-cols-5 gap-1`}>
        <div className={`${props.showImage == true && props.cocktailRecipe._count.CocktailRecipeImage > 0 ? 'col-span-3' : 'col-span-5'}`}>
          {props.cocktailRecipe.steps
            ?.sort((a, b) => a.stepNumber - b.stepNumber)
            ?.map((step, index) => (
              <div key={`step-${step.id}`} className={'pb-2 break-words'}>
                <span className={`font-bold ${step.optional && 'italic'}`}>
                  {userContext.getTranslation(step.action.name, 'de')}
                  {step.optional ? ' (optional)' : ''}
                </span>
                {step.ingredients
                  ?.sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                  .map((stepIngredient, indexIngredient) => (
                    <div
                      key={`cocktail-${props.cocktailRecipe.id}-step-${step.id}-ingredient-${stepIngredient.id}-index-${indexIngredient}`}
                      className={`flex flex-row gap-2 pl-2 ${stepIngredient.optional && 'italic'}`}
                    >
                      <div className={'flex flex-row gap-1'}>
                        <div>
                          {stepIngredient.amount?.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          }) ?? ''}
                        </div>
                        <div>{userContext.getTranslation(stepIngredient?.unit?.name ?? '', 'de')}</div>
                      </div>
                      <div>
                        {stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name ?? ''}
                        {stepIngredient.optional ? ' (optional)' : ''}
                      </div>
                    </div>
                  ))}
              </div>
            ))}

          {props.cocktailRecipe.garnishes.length == 0 ? <></> : <div className={`border-base-100 mb-1 border-b`}></div>}
          <div>
            {props.cocktailRecipe.garnishes.length == 0 ? <></> : <div className={'font-bold'}>Garnitur</div>}
            <div>
              {props.cocktailRecipe.garnishes
                ?.sort((a, b) => a.garnishNumber - b.garnishNumber)
                .map((garnish) => (
                  <div
                    key={`cocktail-${props.cocktailRecipe.id}-garnish-${garnish.garnishNumber}-garnishId-${garnish.garnishId}`}
                    className={`pl-2 ${garnish.optional ? 'italic' : ''}`}
                  >
                    {garnish?.garnish?.name}
                    {garnish.optional ? ' (optional)' : ''}
                  </div>
                )) ?? 'Keine'}
            </div>
          </div>
        </div>
        {props.showImage && props.cocktailRecipe._count.CocktailRecipeImage > 0 ? (
          <div className={'col-span-2 h-full w-full items-start self-start justify-self-center'}>
            <Image
              onClick={() =>
                modalContext.openModal(
                  <ImageModal image={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`} />,
                )
              }
              src={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`}
              className={'h-full w-full grow cursor-pointer rounded-xl object-cover'}
              alt={''}
              width={300}
              height={534}
            />
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
