import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";
import React, { useContext } from "react";
import { CompactCocktailRecipeInstruction } from "./CompactCocktailRecipeInstruction";
import { FaInfoCircle } from "react-icons/fa";
import { ModalContext } from "../../lib/context/ModalContextProvider";
import { CocktailDetailModal } from "./CocktailDetailModal";

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
}

export default function CocktailRecipeOverviewItem(props: CocktailRecipeOverviewItemProps) {
  const modalContext = useContext(ModalContext);
  return (
    <div className={"col-span-1"}>
      <div className={"card card-side"}>
        <div className={"absolute top-1 right-1 btn btn-ghost btn-sm btn-circle bg-info/50"} onClick={() =>
          modalContext.openModal(<CocktailDetailModal cocktail={props.cocktailRecipe} />)
        }><FaInfoCircle /></div>
        <div className={"card-body"}>
          <CompactCocktailRecipeInstruction
            specialPrice={props.specialPrice}
            showPrice={props.showPrice ?? true}
            cocktailRecipe={props.cocktailRecipe} />
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
