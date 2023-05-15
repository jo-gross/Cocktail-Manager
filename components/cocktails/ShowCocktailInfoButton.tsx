import { CocktailDetailModal } from "../modals/CocktailDetailModal";
import { FaInfoCircle } from "react-icons/fa";
import { useContext } from "react";
import { ModalContext } from "../../lib/context/ModalContextProvider";
import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";

interface ShowCocktailInfoButtonProps {
  showInfo: boolean;
  cocktailRecipe: CocktailRecipeFull;
}

export function ShowCocktailInfoButton(props: ShowCocktailInfoButtonProps) {
  const modalContext = useContext(ModalContext);

  return (props.showInfo == true ?
    <div className={"absolute top-1 right-1 btn btn-ghost btn-sm btn-circle bg-info/50"}
         onClick={async () => {
           await modalContext.closeModal();
           //Strange bug, otherwise the modal is closed after setting the content
           await new Promise(r => setTimeout(r, 1));
           await modalContext.openModal(<CocktailDetailModal cocktail={props.cocktailRecipe} />);
         }
         }>
      <FaInfoCircle />
    </div> : <></>);

}
