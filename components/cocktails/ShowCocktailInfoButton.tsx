import { CocktailDetailModal } from '../modals/CocktailDetailModal';
import { FaInfoCircle } from 'react-icons/fa';
import { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';

interface ShowCocktailInfoButtonProps {
  showInfo?: boolean;
  absolutePosition?: boolean;
  cocktailRecipe: CocktailRecipeFull;
  customButton?: JSX.Element;
}

export function ShowCocktailInfoButton(props: ShowCocktailInfoButtonProps) {
  const modalContext = useContext(ModalContext);

  return props.showInfo ?? true ? (
    <div
      className={`
      ${props.customButton ? '' : 'btn btn-circle btn-ghost btn-sm bg-info/50'}
       ${props.absolutePosition == true ? ' absolute right-1 top-1 ' : ''} print:hidden`}
      onClick={async () => {
        await modalContext.closeModal();
        //Strange bug, otherwise the modal is closed after setting the content
        await new Promise((r) => setTimeout(r, 1));
        await modalContext.openModal(<CocktailDetailModal cocktail={props.cocktailRecipe} />);
      }}
    >
      {props.customButton ?? <FaInfoCircle />}
    </div>
  ) : (
    <></>
  );
}
