import React, { useCallback, useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import StarsComponent from '../StarsComponent';
import { FaTrashAlt } from 'react-icons/fa';
import { Role } from '@prisma/client';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface CocktailRatingModalProps {
  cocktail: CocktailRecipeFull;
}

export default function CocktailRatingsModal(props: CocktailRatingModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  const avgRating = props.cocktail.ratings.reduce((acc, rating) => acc + rating.rating, 0) / props.cocktail.ratings.length;

  const [search, setSearch] = React.useState<string>('');

  const handleDelete = useCallback((ratingId: string) => {}, []);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'flex flex-row items-center gap-1 text-2xl font-bold'}>
        {props.cocktail.name} - {parseFloat(avgRating.toFixed(1).toString()).toLocaleString()} <StarsComponent rating={avgRating} />{' '}
        {props.cocktail.ratings.length ?? 'Keine Bewertungen'}
      </div>
      <input
        className={'input input-sm input-bordered'}
        placeholder={'Nach Person suchen...'}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className={'flex flex-col divide-y'}>
        {props.cocktail.ratings
          .filter(
            (rating) => (rating.name ?? '').toLowerCase().includes(search.toLowerCase()) || (rating.comment ?? '').toLowerCase().includes(search.toLowerCase()),
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((rating) => (
            <div key={rating.id} className={'flex w-full flex-col p-1'}>
              {rating.name && (
                <div className={'flex flex-row justify-between gap-2'}>
                  <div className={'font-bold'}>{rating.name}</div>
                  <div className={'font-thin italic'}>{new Date(rating.createdAt).toFormatDateString()}</div>
                  <div className={'btn btn-square btn-outline btn-error btn-xs'}>
                    <FaTrashAlt />
                  </div>
                </div>
              )}
              <div className={'flex flex-row items-center justify-between gap-2'}>
                <StarsComponent rating={rating.rating} />
                {!rating.name && (
                  <div className={'flex flex-row items-center gap-2 font-thin italic'}>
                    {new Date(rating.createdAt).toFormatDateString()}
                    {userContext.isUserPermitted(Role.MANAGER) && (
                      <button
                        type={'button'}
                        onClick={() => modalContext.openModal(<DeleteConfirmationModal onApprove={async () => handleDelete(rating.id)} spelling={'DELETE'} />)}
                        className={'btn btn-square btn-outline btn-error btn-xs'}
                      >
                        <FaTrashAlt />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {rating.comment && <div className={'text-justify italic'}>"{rating.comment}"</div>}
            </div>
          ))}
      </div>
    </div>
  );
}
