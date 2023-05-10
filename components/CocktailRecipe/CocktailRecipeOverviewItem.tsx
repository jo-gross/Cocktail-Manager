import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";
import React from "react";
import { CompactCocktailRecipeInstruction } from "../CompactCocktailRecipeInstruction";

interface CocktailRecipeOverviewItemProps {
  cocktailRecipe: CocktailRecipeFull;
  showImage?: boolean;
}

export default function CocktailRecipeOverviewItem(props: CocktailRecipeOverviewItemProps) {
  return (
    <div className={"col-span-1"}>
      <div className={"card"}>
        {props.showImage && (
          <figure className={"relative"}>
            <div className={"absolute top-1 right-1 bg-accent rounded-xl p-2"}>
              {props.cocktailRecipe.price} € (+
              {props.cocktailRecipe.glass.deposit}€)
            </div>
            <div className={"absolute bottom-1 space-x-2 space-y-2"}>
              {props.cocktailRecipe.tags.map((tag) => (
                <div key={props.cocktailRecipe.id + "-" + tag} className={"badge badge-accent"}>
                  {tag}
                </div>
              ))}
            </div>
            <img src={props.cocktailRecipe.image} alt={"Cocktail"} />
          </figure>
        )}
        <div className={"card-body"}>
          <CompactCocktailRecipeInstruction showPrice={!props.showImage} cocktailRecipe={props.cocktailRecipe} />
        </div>
      </div>
    </div>
  );
}
