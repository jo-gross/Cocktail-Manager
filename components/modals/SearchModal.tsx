import { BsSearch } from 'react-icons/bs';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { Loading } from '../Loading';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { alertService } from '../../lib/alertService';
import { FaPlus } from 'react-icons/fa';
import { MdPlaylistAdd } from 'react-icons/md';
import { addCocktailToQueue, addCocktailToStatistic } from '../../lib/network/cocktailTracking';
import CocktailRecipeCardItem from '../cocktails/CocktailRecipeCardItem';
import _ from 'lodash';

interface SearchModalProps {
  onCocktailSelectedObject?: (cocktail: CocktailRecipeFull) => void;
  selectedCocktails?: string[];
  selectionLabel?: string;
  showRecipe?: boolean;
  showStatisticActions?: boolean;
  customWidthClassName?: string;
}

export function SearchModal(props: SearchModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const showRecipe = props.showRecipe ?? true;

  const [search, setSearch] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [isLoading, setLoading] = useState(false);

  const controllerRef = useRef<AbortController>(new AbortController());

  const fetchCocktails = useCallback(
    (search: string) => {
      if (!workspaceId) return;
      controllerRef.current.abort(); // Vorherige Anfrage abbrechen
      const newAbortController = new AbortController();
      controllerRef.current = newAbortController;

      setLoading(true);
      fetch(
        `/api/workspaces/${workspaceId}/cocktails?` +
          new URLSearchParams({
            search: search,
          }),

        { signal: newAbortController.signal },
      )
        .then(async (response) => {
          const body = await response.json();
          if (response.ok) {
            setCocktails(body.data);
          } else {
            console.error('SearchModal -> search', response);
            alertService.error(body.message ?? 'Fehler beim Suchen der Cocktails', response.status, response.statusText);
          }
        })
        .catch((error) => {
          if (error.name != 'AbortError') {
            console.error('SearchModal -> search', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [workspaceId],
  );

  useEffect(() => {
    if (workspaceId == undefined) return;
    fetchCocktails('');
  }, [fetchCocktails, workspaceId]);

  const [submittingStatistic, setSubmittingStatistic] = useState(false);
  const [submittingQueue, setSubmittingQueue] = useState(false);

  const renderCocktailCard = (cocktail: CocktailRecipeFull, index: number, isArchived: boolean, openCard: boolean = false) => (
    <div
      key={'search-modal-' + cocktail.id}
      tabIndex={index}
      className={` ${showRecipe ? `collapse ${openCard ? 'collapse-open' : 'collapse-arrow'}` : ''} rounded-box border border-base-300 bg-base-100`}
    >
      {showRecipe ? <input type="checkbox" /> : <></>}
      <div className={`${showRecipe ? 'collapse-title' : 'p-2 md:p-3'} flex justify-between text-xl font-medium`}>
        {cocktail.name} {isArchived && '(Archiviert)'}
        {!showRecipe && props.onCocktailSelectedObject != undefined ? (
          <button
            type="button"
            disabled={props.selectedCocktails?.includes(cocktail.id) ?? false}
            className={'btn btn-primary btn-sm'}
            onClick={() => {
              props.onCocktailSelectedObject?.(cocktail);
              setSearch('');
              modalContext.closeModal();
            }}
          >
            {props.selectionLabel ?? 'Hinzufügen'}
          </button>
        ) : (
          <></>
        )}
      </div>
      {showRecipe && (
        <div className="collapse-content ml-2 mr-2 md:ml-3">
          <CocktailRecipeCardItem
            cocktailRecipe={cocktail}
            showImage={true}
            showTags={true}
            showDescription={true}
            showHistory={true}
            showNotes={true}
            showRating={true}
            showStatisticActions={false}
            showPrice={true}
            showInfo={true}
          />

          {props.onCocktailSelectedObject != undefined ? (
            <div className={'card-actions flex flex-row justify-end pt-2'}>
              <button
                type="button"
                disabled={props.selectedCocktails?.includes(cocktail.id) ?? false}
                className={'btn btn-primary btn-sm'}
                onClick={() => {
                  props.onCocktailSelectedObject?.(cocktail);
                  setSearch('');
                  modalContext.closeModal();
                }}
              >
                {props.selectionLabel ?? 'Hinzufügen'}
              </button>
            </div>
          ) : (
            <></>
          )}

          {props.showStatisticActions ? (
            <div className={'mt-2 flex flex-row gap-2 pb-2'}>
              <button
                className={'btn btn-outline w-full flex-1'}
                onClick={() =>
                  addCocktailToQueue({
                    workspaceId: router.query.workspaceId as string,
                    cocktailId: cocktail.id,
                    setSubmitting: setSubmittingQueue,
                  })
                }
                disabled={submittingQueue}
              >
                <MdPlaylistAdd />
                Liste
                {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
              </button>

              <button
                className={'btn btn-outline btn-primary w-full flex-1'}
                onClick={() =>
                  addCocktailToStatistic({
                    workspaceId: router.query.workspaceId as string,
                    cocktailId: cocktail.id,
                    actionSource: 'SEARCH_MODAL',
                    setSubmitting: setSubmittingStatistic,
                  })
                }
                disabled={submittingStatistic}
              >
                <FaPlus />
                Gemacht
                {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
              </button>
            </div>
          ) : (
            <></>
          )}
        </div>
      )}
    </div>
  );

  const groupedCocktails = _.groupBy(cocktails, 'isArchived');

  return (
    <div className={`grid w-full grid-cols-1 gap-2 p-0.5 md:p-2 ${props.customWidthClassName ? props.customWidthClassName : 'md:max-w-2xl'}`}>
      <div className={'w-max text-2xl font-bold'}>Cocktail suchen</div>
      <div className={'join pb-2'}>
        <input
          className={'input join-item input-bordered w-full'}
          value={search}
          autoFocus={true}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim().length != 0) {
              fetchCocktails(e.target.value);
            }
          }}
        />
        <span
          className={'btn btn-square btn-outline btn-primary join-item'}
          onClick={() => {
            fetchCocktails(search);
          }}
        >
          <BsSearch />
        </span>
      </div>
      <>
        {cocktails.length == 0 ? (
          search != '' ? (
            <div>Keine Einträge gefunden</div>
          ) : (
            <></>
          )
        ) : (
          <>
            {groupedCocktails['false']?.length > 0 &&
              groupedCocktails['false']
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cocktail, index) => renderCocktailCard(cocktail, index, false, groupedCocktails['false']?.length == 1))}
            {groupedCocktails['true']?.length > 0 && (
              <div tabIndex={0} className="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div className="collapse-title text-xl font-medium">Archiviert</div>
                <div className="collapse-content">
                  {groupedCocktails['true'].sort((a, b) => a.name.localeCompare(b.name)).map((cocktail, index) => renderCocktailCard(cocktail, index, true))}
                </div>
              </div>
            )}
          </>
        )}
        {isLoading ? <Loading /> : <></>}
      </>
    </div>
  );
}
