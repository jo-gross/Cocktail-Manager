import { BsSearch } from 'react-icons/bs';
import { CompactCocktailRecipeInstruction } from '../cocktails/CompactCocktailRecipeInstruction';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { Loading } from '../Loading';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { ShowCocktailInfoButton } from '../cocktails/ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { alertService } from '../../lib/alertService';

interface SearchModalProps {
  onCocktailSelectedObject?: (cocktail: CocktailRecipeFull) => void;
  selectedCocktails?: string[];
  selectionLabel?: string;
  showRecipe?: boolean;
}

export function SearchModal(props: SearchModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const showRecipe = props.showRecipe ?? true;

  const [search, setSearch] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [isLoading, setLoading] = useState(false);

  let controller = new AbortController();

  const fetchCocktails = useCallback(
    (search: string) => {
      if (!workspaceId) return;
      controller.abort(); // Vorherige Anfrage abbrechen
      const newAbortController = new AbortController();
      controller = newAbortController;

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
            console.log('SearchModal -> search', response, body);
            alertService.error(body.message, response.status, response.statusText);
          }
        })
        .catch((err) => {
          if (err.name != 'AbortError') {
            alertService.error(err.message);
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

  return (
    <div className={'grid w-full grid-cols-1 gap-2 p-0.5 md:p-2'}>
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
        <span className={'btn btn-square btn-outline btn-primary join-item'}>
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
          cocktails
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((cocktail, index) => (
              <div
                key={'search-modal-' + cocktail.id}
                tabIndex={index}
                className={` ${
                  showRecipe ? 'collapse collapse-arrow' : ''
                } rounded-box border border-base-300 bg-base-100`}
              >
                {showRecipe ? <input type="checkbox" /> : <></>}
                <div
                  className={`${
                    showRecipe ? 'collapse-title ' : 'p-2 md:p-3'
                  } flex justify-between text-xl font-medium`}
                >
                  {cocktail.name}{' '}
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
                  <div className="collapse-content pl-2 pr-2 md:pl-3">
                    <div className={'card'}>
                      <div className={'card-body'}>
                        <ShowCocktailInfoButton showInfo={true} cocktailRecipe={cocktail} absolutePosition={true} />
                        <CompactCocktailRecipeInstruction showPrice={true} cocktailRecipe={cocktail} showImage={true} />
                      </div>
                    </div>

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
                  </div>
                )}
              </div>
            )) ?? <></>
        )}
        {isLoading ? <Loading /> : <></>}
      </>
    </div>
  );
}
