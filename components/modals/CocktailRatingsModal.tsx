import React, { useCallback, useContext, useEffect } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import StarsComponent from '../StarsComponent';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import { CocktailRating, Role } from '@generated/prisma/client';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { alertService } from '@lib/alertService';
import AddCocktailRatingModal from './AddCocktailRatingModal';
import '../../lib/DateUtils';

interface CocktailRatingModalProps {
  cocktailId: string;
  cocktailName: string;
  onUpdate?: () => void;
}

export default function CocktailRatingsModal(props: CocktailRatingModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [cocktailRatings, setCocktailRatings] = React.useState<CocktailRating[]>([]);

  const router = useRouter();

  const { workspaceId } = router.query;

  const avgRating = (cocktailRatings ?? []).reduce((acc, rating) => acc + (rating.rating ?? 0), 0) / (cocktailRatings ?? []).length;

  const [search, setSearch] = React.useState<string>('');

  const fetchCocktailRating = useCallback(async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailId}/ratings`);
    const body = await response.json();
    if (response.ok) {
      setCocktailRatings(body.data);
    } else {
      console.error(`CocktailRatingModal -> fetchCocktailRating`, response);
      alertService.error(body.message ?? 'Fehler beim Laden der Bewertungen', response.status, response.statusText);
    }
  }, [props.cocktailId, workspaceId]);

  const handleDelete = useCallback(
    async (ratingId: string) => {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailId}/ratings/${ratingId}`, {
        method: 'DELETE',
      });

      const body = await response.json();
      if (response.ok) {
        await fetchCocktailRating();
        props.onUpdate?.();
        alertService.success('Erfolgreich gelöscht');
      } else {
        console.error(`CocktailRatingModal[${ratingId}] -> delete`, response);
        alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
      }
    },
    [fetchCocktailRating, props, workspaceId],
  );

  useEffect(() => {
    fetchCocktailRating();
  }, [fetchCocktailRating]);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'flex flex-row items-center gap-1 text-2xl font-bold'}>
        {props.cocktailName} -{' '}
        {cocktailRatings.length > 0
          ? avgRating.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          : 'N/A'}{' '}
        <StarsComponent rating={avgRating} /> ({cocktailRatings.length})<div className={'grow'}></div>
        <button
          type={'button'}
          className={'btn btn-outline btn-sm print:hidden'}
          onClick={() =>
            modalContext.openModal(<AddCocktailRatingModal cocktailId={props.cocktailId} cocktailName={props.cocktailName} onCreated={fetchCocktailRating} />)
          }
        >
          <FaPlus /> Bewertung hinzufügen
        </button>
      </div>

      <input className={'input input-sm'} placeholder={'Nach Person suchen...'} value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className={'flex flex-col divide-y'}>
        {cocktailRatings.filter(
          (rating) => (rating.name ?? '').toLowerCase().includes(search.toLowerCase()) || (rating.comment ?? '').toLowerCase().includes(search.toLowerCase()),
        )?.length === 0 && <div className={'text-center text-gray-500 italic'}>Keine Bewertungen vorhanden</div>}
        {cocktailRatings
          .filter(
            (rating) => (rating.name ?? '').toLowerCase().includes(search.toLowerCase()) || (rating.comment ?? '').toLowerCase().includes(search.toLowerCase()),
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((rating) => (
            <div key={rating.id} className={'flex w-full flex-col p-1'}>
              {rating.name && (
                <div className={'flex flex-row justify-between gap-2'}>
                  <div className={'font-bold'}>{rating.name}</div>
                  <div className={'flex flex-row items-center gap-2 font-thin italic'}>
                    <div className={'font-thin italic'}>{new Date(rating.createdAt).toFormatDateString()}</div>
                    {userContext.isUserPermitted(Role.MANAGER) && (
                      <button
                        type={'button'}
                        onClick={() =>
                          modalContext.openModal(
                            <DeleteConfirmationModal
                              spelling={'DELETE'}
                              entityName={`die ${rating.rating} Sterne Bewertung ${rating.name ? `von ${rating.name} ` : ''}vom ${new Date(rating.createdAt).toFormatDateTimeString()}`}
                              onApprove={async () => handleDelete(rating.id)}
                            />,
                          )
                        }
                        className={'btn btn-square btn-outline btn-error btn-xs'}
                      >
                        <FaTrashAlt />
                      </button>
                    )}
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
                        onClick={() =>
                          modalContext.openModal(
                            <DeleteConfirmationModal
                              spelling={'DELETE'}
                              entityName={`die ${rating.rating} Sterne Bewertung ${rating.name ? `von ${rating.name} ` : ''}vom ${new Date(rating.createdAt).toFormatDateTimeString()}`}
                              onApprove={async () => handleDelete(rating.id)}
                            />,
                          )
                        }
                        className={'btn btn-square btn-outline btn-error btn-xs'}
                      >
                        <FaTrashAlt />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {rating.comment && <div className={'text-justify italic'}>&quot;{rating.comment}&quot;</div>}
            </div>
          ))}
      </div>
    </div>
  );
}
