import { CocktailDetailModal } from '../modals/CocktailDetailModal';
import { FaInfoCircle } from 'react-icons/fa';
import { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';

interface ShowCocktailInfoButtonProps {
  showInfo: boolean;
  cocktailRecipe: CocktailRecipeFull;
}

export function ShowCocktailInfoButton(props: ShowCocktailInfoButtonProps) {
  const modalContext = useContext(ModalContext);

  return props.showInfo ? (
    <div
      className={'btn btn-circle btn-ghost btn-sm absolute right-1 top-1 bg-info/50 print:hidden'}
      onClick={async () => {
        await modalContext.closeModal();
        //Strange bug, otherwise the modal is closed after setting the content
        await new Promise((r) => setTimeout(r, 1));
        await modalContext.openModal(<CocktailDetailModal cocktail={props.cocktailRecipe} />);
      }}
    >
      <FaInfoCircle />
    </div>
  ) : (
    <></>
  );
}
