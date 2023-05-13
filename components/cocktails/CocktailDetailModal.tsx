import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";

interface CocktailDetailModalProps {
  cocktail: CocktailRecipeFull;
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  return <div>
    <div className={""}>
      <div className={"card-body bg-base-100"}>
        <h2 className={"card-title"}>{props.cocktail.name} - <span className={"font-bold"}>{props.cocktail.price}€</span></h2>
        <div className={"grid grid-cols-2 gap-4"}>
          <div className={"col-span-2 flex"}>
            {props.cocktail.tags.map((tag, index) => (<div className={"m-1 badge"}>{tag}</div>))}
          </div>
          <div className={"col-span-2"}>
            <div className={"grid grid-cols-2 gap-4"}>
              <div className={"col-span-2 flex flex-row space-x-2"}>
                <img className={"flex-none rounded-lg shadow-md w-36 h-full object-fit object-center"} src={props.cocktail.image} alt={"Cocktail"} />
                <textarea
                  readOnly={true}
                  value={props.cocktail.description}
                  className={"flex-1 col-span-1 w-full textarea textarea-bordered"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
