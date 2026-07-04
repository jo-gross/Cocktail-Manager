import { CocktailDetailModal } from '../modals/CocktailDetailModal';
import { FaInfoCircle } from 'react-icons/fa';
import { useContext } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Button } from '@components/ui';

interface ShowCocktailInfoButtonProps {
  showInfo: boolean;
  cocktailId: string;
  onRatingChange: () => void;
}

export function ShowCocktailInfoButton(props: ShowCocktailInfoButtonProps) {
  const modalContext = useContext(ModalContext);

  return props.showInfo ? (
    <Button
      type="button"
      variant="ghost"
      shape="circle"
      size="sm"
      className="absolute top-1 right-1 bg-info/50 print:hidden"
      onClick={async () => {
        modalContext.openModal(
          <CocktailDetailModal cocktailId={props.cocktailId} onRefreshRatings={() => props.onRatingChange()} openReferer={'DETAIL'} />,
          true,
        );
      }}
    >
      <FaInfoCircle />
    </Button>
  ) : (
    <></>
  );
}
