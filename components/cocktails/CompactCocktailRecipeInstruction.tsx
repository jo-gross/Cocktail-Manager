import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useContext, useState } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import Image, { ImageProps } from 'next/image';
import { ModalContext } from '@lib/context/ModalContextProvider';
import ImageModal from '../modals/ImageModal';
import { Loading } from '../Loading';
import StarsComponent from '../StarsComponent';
import { CocktailRating } from '@generated/prisma/client';
import { Skeleton } from '@components/ui';
import '../../lib/NumberUtils';

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
  showImage?: boolean;
  image?: string;

  showRating?: { ratings: CocktailRating[]; loading: boolean; error: boolean };
}

interface ImageWithSkeletonProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  skeletonClassName?: string;
}

function ImageWithSkeleton({ skeletonClassName, className, onClick, ...imageProps }: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <div className={`relative ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {!loaded ? <Skeleton className={skeletonClassName ?? 'h-full w-full rounded-xl'} aria-hidden /> : null}
      <Image
        {...imageProps}
        className={`${className ?? ''} ${loaded ? 'opacity-100' : 'absolute inset-0 opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
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
            ? (props.specialPrice?.formatPriceEfficent() ?? props.cocktailRecipe.price?.formatPriceEfficent() + ' €')
            : ''}
        </div>
      ) : (
        <></>
      )}
      {props.cocktailRecipe.glass && props.cocktailRecipe.glass._count.GlassImage != 0 && (
        <div className={`${props.showRating ? 'row-span-3' : 'row-span-2'} flex h-full items-center justify-center`}>
          <ImageWithSkeleton
            className="h-16 w-fit object-contain"
            skeletonClassName="h-16 w-12 rounded-lg"
            src={`/api/workspaces/${props.cocktailRecipe.workspaceId}/glasses/${props.cocktailRecipe.glass?.id}/image`}
            alt={props.cocktailRecipe.glass?.name ?? 'Cocktail-Glas'}
            onClick={() =>
              modalContext.openModal(
                <ImageModal image={`/api/workspaces/${props.cocktailRecipe.workspaceId}/glasses/${props.cocktailRecipe.glass?.id}/image`} />,
              )
            }
            width={200}
            height={200}
            unoptimized={true}
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
      <div className={'col-span-4 border-b border-base-100'}></div>
      <div className={`col-span-4 grid grid-cols-5 gap-1`}>
        <div className={`${props.showImage == true && props.cocktailRecipe._count.CocktailRecipeImage > 0 ? 'col-span-3' : 'col-span-5'}`}>
          {props.cocktailRecipe.steps
            ?.sort((a, b) => a.stepNumber - b.stepNumber)
            ?.map((step, _index) => (
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

          {props.cocktailRecipe.garnishes.length == 0 ? <></> : <div className={`mb-1 border-b border-base-100`}></div>}
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
                    {garnish.isAlternative && <span className="font-bold">oder </span>}
                    {garnish?.garnish?.name}
                    {garnish.optional ? ' (optional)' : ''}
                  </div>
                )) ?? 'Keine'}
            </div>
          </div>
        </div>
        {props.showImage && props.cocktailRecipe._count.CocktailRecipeImage > 0 ? (
          <div className={'col-span-2 h-full w-full items-start self-start justify-self-center'}>
            <ImageWithSkeleton
              onClick={() =>
                modalContext.openModal(
                  <ImageModal image={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`} />,
                )
              }
              src={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`}
              className="h-full w-full flex-grow rounded-xl object-cover"
              skeletonClassName="aspect-9/16 h-full w-full rounded-xl"
              alt=""
              width={300}
              height={534}
              unoptimized={true}
            />
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
