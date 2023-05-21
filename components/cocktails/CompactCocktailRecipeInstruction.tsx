import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React from 'react';

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
  showImage?: boolean;
}

export function CompactCocktailRecipeInstruction(props: CompactCocktailRecipeInstructionProps) {
  return (
    <div className={'grid grid-cols-4 gap-1'}>
      <div className={`${props.showPrice ? 'col-span-2' : 'col-span-3'} font-bold text-xl`}>
        {props.cocktailRecipe.name == '' ? '<Name>' : props.cocktailRecipe.name}
      </div>
      {props.showPrice == true ? (
        <div className={'col-span-1 text-right font-bold text-xl'}>
          {props.specialPrice ?? props.cocktailRecipe.price} €
        </div>
      ) : (
        <></>
      )}
      <div className={'row-span-2 flex justify-center items-center h-min'}>
        <img
          className="h-16"
          src={props.cocktailRecipe.glass?.image ?? '/images/glasses/default-glass.png'}
          alt={props.cocktailRecipe.glass?.name}
        />
      </div>
      <div className={'col-span-3 font-thin flex flex-row space-x-2 justify-between'}>
        <div>Glas: {props.cocktailRecipe.glass?.name ?? '<Glas>'}</div>
        <div>Eis: {props.cocktailRecipe?.glassWithIce ?? '<Eis>'}</div>
      </div>
      <div className={'border-b border-base-100 col-span-4'}></div>
      <div
        className={`${
          props.cocktailRecipe.image != undefined && props.showImage == true ? 'col-span-3' : 'col-span-4'
        }`}
      >
        {props.cocktailRecipe.steps
          ?.sort((a, b) => a.stepNumber - b.stepNumber)
          .map((step, index) => (
            <div key={`step-${step.id}`} className={'break-words pb-2'}>
              <span className={'font-bold'}>{step.tool} </span>
              {step.mixing &&
                step.ingredients
                  ?.sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                  .map((ingredient, indexIngredient) => (
                    <div
                      key={`cocktail-${props.cocktailRecipe.id}-step-${step.id}-ingredient-${ingredient.id}-index-${indexIngredient}`}
                    >
                      {ingredient.amount ?? ''} {ingredient.unit ?? ''}{' '}
                      {ingredient.ingredient?.shortName ?? ingredient.ingredient?.name ?? ''}{' '}
                      {indexIngredient < step.ingredients.length - 1 ? <></> : <></>}
                    </div>
                  ))}
            </div>
          ))}
      </div>
      {props.cocktailRecipe.image != undefined && props.showImage == true ? (
        <div className={'row-span-3 justify-self-center self-center h-full pt-2'}>
          <img src={props.cocktailRecipe.image} className={'object-cover h-full w-fit rounded-xl'} alt={''} />
        </div>
      ) : (
        <></>
      )}
      <div
        className={`border-b border-base-100 ${
          props.cocktailRecipe.image != undefined && props.showImage == true ? 'col-span-3' : 'col-span-4'
        }`}
      ></div>
      <div
        className={`${
          props.cocktailRecipe.image != undefined && props.showImage == true ? 'col-span-3' : 'col-span-4'
        }`}
      >
        <div className={'font-bold'}>Deko</div>
        <div>
          {props.cocktailRecipe.garnishes
            ?.sort((a, b) => a.garnishNumber - b.garnishNumber)
            .map((garnish) => (
              <div
                key={`cocktail-${props.cocktailRecipe.id}-garnish-${garnish.garnishNumber}-garnishId-${garnish.garnishId}`}
              >
                {garnish.garnish.name}
                {garnish.optional ? ' (optional)' : ''}
              </div>
            )) ?? 'Keine'}
        </div>
      </div>
    </div>
  );
}
