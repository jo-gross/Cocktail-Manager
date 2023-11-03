import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
  showImageSide?: boolean;
}

export default function CocktailRecipeOverviewItem(props: CocktailRecipeOverviewItemProps) {
  return (
    <div className={'col-span-1'}>
      <div className={'card card-side h-full'}>
        <ShowCocktailInfoButton showInfo={props.showInfo ?? false} cocktailRecipe={props.cocktailRecipe} />
        <div className={'card-body'}>
          <CompactCocktailRecipeInstruction
            specialPrice={props.specialPrice}
            showImage={!(props.showImageSide == true) && (props.showImage ?? false)}
            showPrice={props.showPrice ?? true}
            cocktailRecipe={props.cocktailRecipe}
          />
          <div className={'h-full'}></div>
          <div className={'bottom-0'}>
            {props.showTags ? (
              props.cocktailRecipe.tags.map((tag) => (
                <span
                  key={`cocktail-overview-item-${props.cocktailRecipe.id}-tag-${tag}`}
                  className={'badge badge-primary badge-outline mr-1'}
                >
                  {tag}
                </span>
              ))
            ) : (
              <></>
            )}
          </div>
        </div>
        {props.showImageSide &&
        props.showImage &&
        props.cocktailRecipe.image != '' &&
        props.cocktailRecipe.image != undefined ? (
          <figure>
            <img
              className={' object-fit h-full w-36 object-center shadow-md'}
              src={props.cocktailRecipe.image}
              alt={'Cocktail'}
            />
          </figure>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
