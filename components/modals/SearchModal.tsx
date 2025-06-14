import { BsSearch } from 'react-icons/bs';
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { Loading } from '../Loading';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import CocktailRecipeCardItem from '../cocktails/CocktailRecipeCardItem';
import _ from 'lodash';
import StatisticActions from '../StatisticActions';

interface SearchModalProps {
  onCocktailSelectedObject?: (cocktail: CocktailRecipeFull) => void;
  selectedCocktails?: string[];
  selectionLabel?: string;
  showRecipe?: boolean;
  showStatisticActions?: boolean;
  customWidthClassName?: string;
  notAsModal?: boolean;
}

export type SearchModalRef = {
  refresh: (selectedCocktailId?: string) => Promise<void>;
};

export const SearchModal = forwardRef<SearchModalRef, SearchModalProps>((props, ref) => {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const showRecipe = props.showRecipe ?? true;

  const [search, setSearch] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [isLoading, setLoading] = useState(false);

  const controllerRef = useRef<AbortController>(new AbortController());

  const fetchCocktails = useCallback(
    async (search: string) => {
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
    fetchCocktails('').then();
  }, [fetchCocktails, workspaceId]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: async (selectedCocktailId) => {
        await fetchCocktails(search);
        if (selectedCocktailId) {
          const selectedCocktail = cocktails.find((c) => c.id === selectedCocktailId);
          if (selectedCocktail && props.onCocktailSelectedObject) {
            props.onCocktailSelectedObject(selectedCocktail);
          }
        }
      },
    }),
    [cocktails, fetchCocktails, props, search],
  );

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
            showDetailsOnClick={true}
          />

          {props.onCocktailSelectedObject != undefined ? (
            <div className={'card-actions flex flex-row justify-end py-2'}>
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
            <div className={'mt-2 pb-2'}>
              <StatisticActions
                workspaceId={router.query.workspaceId as string}
                cocktailId={cocktail.id}
                cocktailName={cocktail.name}
                actionSource={'SEARCH_MODAL'}
              />
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
      <div className={'sticky w-full'}>
        <div className={'w-max text-2xl font-bold'}>Cocktail suchen</div>
        <div className={'join w-full pb-2'}>
          <input
            className={'input join-item input-bordered w-full'}
            value={search}
            autoFocus={true}
            onChange={async (e) => {
              setSearch(e.target.value);
              if (e.target.value.trim().length != 0) {
                await fetchCocktails(e.target.value);
              }
            }}
          />
          <button
            type={'button'}
            disabled={isLoading}
            className={`btn ${isLoading ? 'w-fit px-2' : 'btn-square'} btn-outline btn-primary join-item`}
            onClick={async () => {
              await fetchCocktails(search);
            }}
          >
            {isLoading ? <span className={'loading loading-spinner loading-xs'}></span> : <></>}
            <BsSearch />
          </button>
        </div>
      </div>
      <div
        className={`${props.notAsModal ? (process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 'h-[calc(100vh-12rem)]' : 'h-[calc(100vh-9.5rem)]') : ''} flex flex-col gap-1 overflow-y-auto`}
      >
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
                  <div className={'flex flex-col gap-1 p-0.5'}>
                    {groupedCocktails['true'].sort((a, b) => a.name.localeCompare(b.name)).map((cocktail, index) => renderCocktailCard(cocktail, index, true))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {isLoading ? <Loading /> : <></>}
      </div>
    </div>
  );
});

SearchModal.displayName = 'SearchModal';
