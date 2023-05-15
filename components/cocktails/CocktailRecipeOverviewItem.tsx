import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";
import React, { useContext } from "react";
import { CompactCocktailRecipeInstruction } from "./CompactCocktailRecipeInstruction";
import { ModalContext } from "../../lib/context/ModalContextProvider";
import { ShowCocktailInfoButton } from "./ShowCocktailInfoButton";

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
}

export default function CocktailRecipeOverviewItem(props: CocktailRecipeOverviewItemProps) {
  const modalContext = useContext(ModalContext);
  return (
    <div className={"col-span-1"}>
      <div className={"card card-side"}>
        <ShowCocktailInfoButton showInfo={props.showInfo}
                                cocktailRecipe={props.cocktailRecipe} />
        <div className={"card-body"}>
          <CompactCocktailRecipeInstruction
            specialPrice={props.specialPrice}
            showPrice={props.showPrice ?? true}
            cocktailRecipe={props.cocktailRecipe} />
          <div>
            {props.showTags ? props.cocktailRecipe.tags.map((tag) => (
              <span className={"badge badge-outline badge-primary mr-1"}>{tag}</span>
            )) : <></>}
          </div>
        </div>
        {(props.showImage && props.cocktailRecipe.image != "" && props.cocktailRecipe.image != undefined) ? (
          <figure>
            <img
              className={"rounded-lg shadow-md w-36 h-full object-fit object-center"}
              src={props.cocktailRecipe.image}
              alt={"Cocktail"} />
          </figure>
        ) : <></>}
      </div>
    </div>
  );
}
