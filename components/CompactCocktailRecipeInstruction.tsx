import { CocktailRecipeFull } from "../models/CocktailRecipeFull";

interface CompactCocktailRecipeInstructionProps {
  cocktailRecipe: CocktailRecipeFull;
  showPrice?: boolean;
  specialPrice?: number;
}

export function CompactCocktailRecipeInstruction(props: CompactCocktailRecipeInstructionProps) {
  return (
    <div className={"grid grid-cols-4 gap-2 divide-y"}>
      <div className={`${props.showPrice ? "col-span-2" : "col-span-3"} font-bold text-xl`}>{props.cocktailRecipe.name == "" ? "<Name>" : props.cocktailRecipe.name}</div>
      {props.showPrice == true ? (
        <div className={"col-span-1 text-right font-bold text-xl"}>
          {props.specialPrice ?? props.cocktailRecipe.price} €
        </div>
      ) : <></>}
      <div className={"row-span-2 flex justify-center items-center h-min"}><img className="h-20" src={props.cocktailRecipe.glass?.image} alt={props.cocktailRecipe.glass?.name} />
      </div>
      <div className={"col-span-3 font-thin flex flex-row space-x-2 justify-between"}>
        <div>Glas: {props.cocktailRecipe.glass?.name ?? "<Glas>"}</div>
        <div>Eis: {props.cocktailRecipe?.glassWithIce ?? "<Eis>"}</div>
      </div>
      <div className={"border-b border-base-200 col-span-4"}></div>
      <div className={"col-span-4"}>
        {props.cocktailRecipe.steps?.sort((a,b) => a.stepNumber - b.stepNumber).map((step, index) => (
          <div key={`step-${step.id}`} className={"flex flex-row space-x-2"}>
            <div className={"font-bold"}>{step.tool}</div>
            {step.mixing && (
              <div className={"flex flex-row break-words space-x-2 items-center"}>
                {step.ingredients?.sort((a, b) => a.ingredientNumber - b.ingredientNumber).map((ingredient, indexIngredient) => `${ingredient.amount ?? ""}${ingredient.unit ?? ""} ${ingredient.ingredient?.shortName ?? ingredient.ingredient?.name ?? ""} ${indexIngredient < step.ingredients.length - 1 ? " ➜ " : ""}`)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={"border-b border-base-200 col-span-4"}></div>
      <div className={"col-span-4"}>
        Deko: {props.cocktailRecipe.decoration?.name}
      </div>
    </div>
  );
}
