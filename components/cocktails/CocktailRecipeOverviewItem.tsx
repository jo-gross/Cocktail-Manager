import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React, { useContext, useEffect } from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ModalContext } from '../../lib/context/ModalContextProvider';
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
  const modalContext = useContext(ModalContext);

  useEffect(() => {
    console.log('showImage', props.showImage);
  }, [props.showImage]);

  return (
    <div className={'col-span-1'}>
      <div className={'card card-side'}>
        <ShowCocktailInfoButton showInfo={props.showInfo ?? false} cocktailRecipe={props.cocktailRecipe} />
        <div className={'card-body'}>
          <CompactCocktailRecipeInstruction
            specialPrice={props.specialPrice}
            showImage={!(props.showImageSide == true) && (props.showImage ?? false)}
            showPrice={props.showPrice ?? true}
            cocktailRecipe={props.cocktailRecipe}
          />
          <div>
            {props.showTags ? (
              props.cocktailRecipe.tags.map((tag) => (
                <span
                  key={`cocktail-overview-item-${props.cocktailRecipe.id}-tag-${tag}`}
                  className={'badge badge-outline badge-primary mr-1'}
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
              className={' shadow-md w-36 h-full object-fit object-center'}
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
