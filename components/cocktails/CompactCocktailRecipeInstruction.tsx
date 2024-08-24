import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useContext } from 'react';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { UserContext } from '../../lib/context/UserContextProvider';
import Image from 'next/image';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import ImageModal from '../modals/ImageModal';

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
  showImage?: boolean;
  image?: string;
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
          {(props.specialPrice ?? props.cocktailRecipe.price) != undefined ? (props.specialPrice ?? props.cocktailRecipe.price + ' €') : ''}
        </div>
      ) : (
        <></>
      )}
      <div className={'row-span-2 flex h-min items-center justify-center'}>
        {props.cocktailRecipe.glass && props.cocktailRecipe.glass._count.GlassImage != 0 ? (
          <Image
            className={'h-16 object-contain'}
            src={`/api/workspaces/${props.cocktailRecipe.workspaceId}/glasses/${props.cocktailRecipe.glass?.id}/image`}
            alt={props.cocktailRecipe.glass?.name ?? 'Cocktail-Glas'}
            width={200}
            height={200}
          />
        ) : (
          <div className={'flex flex-col items-center justify-center'}>
            <DefaultGlassIcon />
          </div>
        )}
      </div>
      <div className={'col-span-3 flex flex-row justify-between space-x-2 font-thin'}>
        <div>Glas: {props.cocktailRecipe.glass?.name ?? '<Glas>'}</div>
        <div>Eis: {userContext.getTranslation(props.cocktailRecipe.ice?.name ?? '<Eis>', 'de')}</div>
      </div>
      <div className={'col-span-4 border-b border-base-100'}></div>
      <div className={`${props.showImage == true ? 'col-span-3' : 'col-span-4'}`}>
        {props.cocktailRecipe.steps
          ?.sort((a, b) => a.stepNumber - b.stepNumber)
          ?.map((step, index) => (
            <div key={`step-${step.id}`} className={'break-words pb-2'}>
              <span className={'font-bold'}>{userContext.getTranslation(step.action.name, 'de')}</span>
              {step.ingredients
                ?.sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                .map((stepIngredient, indexIngredient) => (
                  <div key={`cocktail-${props.cocktailRecipe.id}-step-${step.id}-ingredient-${stepIngredient.id}-index-${indexIngredient}`}>
                    {stepIngredient.amount ?? ''} {userContext.getTranslation(stepIngredient?.unit?.name ?? '', 'de')}{' '}
                    {stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name ?? ''}{' '}
                    {indexIngredient < step.ingredients.length - 1 ? <></> : <></>}
                  </div>
                ))}
            </div>
          ))}
      </div>
      {props.showImage == true ? (
        props.cocktailRecipe._count.CocktailRecipeImage == 0 ? (
          <></>
        ) : (
          <div className={'row-span-3 h-full self-center justify-self-center pt-2'}>
            <Image
              onClick={() =>
                modalContext.openModal(
                  <ImageModal image={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`} />,
                )
              }
              src={props.image ?? `/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`}
              className={'h-full w-fit cursor-pointer rounded-xl object-cover'}
              alt={''}
              width={300}
              height={300}
            />
          </div>
        )
      ) : (
        <></>
      )}
      {props.cocktailRecipe.garnishes.length == 0 ? (
        <></>
      ) : (
        <div className={`border-b border-base-100 ${props.showImage == true && props.image ? 'col-span-3' : 'col-span-4'}`}></div>
      )}
      <div className={`${props.showImage == true ? 'col-span-3' : 'col-span-4'}`}>
        {props.cocktailRecipe.garnishes.length == 0 ? <></> : <div className={'font-bold'}>Deko</div>}
        <div>
          {props.cocktailRecipe.garnishes
            ?.sort((a, b) => a.garnishNumber - b.garnishNumber)
            .map((garnish) => (
              <div key={`cocktail-${props.cocktailRecipe.id}-garnish-${garnish.garnishNumber}-garnishId-${garnish.garnishId}`}>
                {garnish?.garnish?.name}
                {garnish.optional ? ' (optional)' : ''}
              </div>
            )) ?? 'Keine'}
        </div>
      </div>
    </div>
  );
}
