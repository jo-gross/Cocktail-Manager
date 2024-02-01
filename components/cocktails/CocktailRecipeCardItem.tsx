import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import React from 'react';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';
import CustomImage from '../CustomImage';

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
  showImageSide?: boolean;
  image?: string;
}

export default function CocktailRecipeCardItem(props: CocktailRecipeOverviewItemProps) {
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
            <div className={'btn btn-outline btn-primary w-full'}>Gemacht</div>
          </div>
        </div>
        {props.showImageSide && props.showImage ? (
          <CustomImage
            className={' object-fit h-full w-36 object-center shadow-md'}
            src={`/api/workspaces/${props.cocktailRecipe.workspaceId}/cocktails/${props.cocktailRecipe.id}/image`}
            alt={'Cocktail'}
            imageWrapper={(children) => <figure>{children}</figure>}
          />
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
