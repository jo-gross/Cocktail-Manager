import { CocktailDetailModal } from '../modals/CocktailDetailModal';
import { FaInfoCircle } from 'react-icons/fa';
import { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';

interface ShowCocktailInfoButtonProps {
  showInfo: boolean;
  cocktailId: string;
  onRatingChange: () => void;
}

export function ShowCocktailInfoButton(props: ShowCocktailInfoButtonProps) {
  const modalContext = useContext(ModalContext);

  return props.showInfo ? (
    <div
      className={'btn btn-circle btn-ghost btn-sm absolute right-1 top-1 bg-info/50 print:hidden'}
      onClick={async () => {
        modalContext.openModal(<CocktailDetailModal cocktailId={props.cocktailId} onRefreshRatings={() => props.onRatingChange()} />, true);
      }}
    >
      <FaInfoCircle />
    </div>
  ) : (
    <></>
  );
}
