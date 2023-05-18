import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React from 'react';

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
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
      <div className={'col-span-4'}>
        {props.cocktailRecipe.steps
          ?.sort((a, b) => a.stepNumber - b.stepNumber)
          .map((step, index) => (
            <div key={`step-${step.id}`} className={'break-words'}>
              <span className={'font-bold'}>{step.tool} </span>
              {step.mixing &&
                step.ingredients
                  ?.sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                  .map(
                    (ingredient, indexIngredient) =>
                      <div>{ingredient.amount ?? ''} {ingredient.unit ?? ''} {
                        ingredient.ingredient?.shortName ?? ingredient.ingredient?.name ?? ''
                      } {indexIngredient < step.ingredients.length - 1 ? <></> : <></>}</div>,
                  )}
            </div>
          ))}
      </div>
      <div className={'border-b border-base-100 col-span-4'}></div>
      <div className={'col-span-4'}>Deko: {props.cocktailRecipe.decoration?.name ?? 'Keine'}</div>
    </div>
  );
}
