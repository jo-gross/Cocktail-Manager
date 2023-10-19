import { BsSearch } from 'react-icons/bs';
import { CompactCocktailRecipeInstruction } from '../cocktails/CompactCocktailRecipeInstruction';
import React, { useCallback, useContext, useState } from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { Loading } from '../Loading';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { ShowCocktailInfoButton } from '../cocktails/ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { alertService } from '../../lib/alertService';

interface SearchModalProps {
  onCocktailSelected?: (id: string) => void;
  selectedCocktails?: string[];
}

export function SearchModal(props: SearchModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const [search, setSearch] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [isLoading, setLoading] = useState(false);

  const fetchCocktails = useCallback(
    (search: string) => {
      if (!workspaceId) return;
      setSearch(search);
      setLoading(true);
      fetch(
        `/api/workspaces/${workspaceId}/cocktails?` +
          new URLSearchParams({
            search: search,
          }),
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
        .catch((err) => alertService.error(err.message))
        .finally(() => {
          setLoading(false);
        });
    },
    [workspaceId],
  );

  return (
    <div className={'md:p-2 grid grid-cols-1 gap-2 w-fit'}>
      <div className={'font-bold text-2xl'}>Cocktail suchen</div>
      <div className={'input-group min-w-[32rem]'}>
        <input
          className={'w-full input input-bordered'}
          value={search}
          autoFocus={true}
          onChange={(e) => fetchCocktails(e.target.value)}
        />
        <span className={'btn btn-outline btn-primary'}>
          <BsSearch />
        </span>
      </div>
      <>
        {isLoading ? (
          <Loading />
        ) : cocktails.length == 0 ? (
          search != '' ? (
            <div>Keine Einträge gefunden</div>
          ) : (
            <></>
          )
        ) : (
          cocktails.map((cocktail, index) => (
            <div
              key={'search-modal-' + cocktail.id}
              tabIndex={index}
              className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box"
            >
              <input type="checkbox" />
              <div className="collapse-title text-xl font-medium">{cocktail.name}</div>
              <div className="collapse-content">
                <div className={'card'}>
                  <div className={'card-body'}>
                    <ShowCocktailInfoButton showInfo={true} cocktailRecipe={cocktail} />
                    <CompactCocktailRecipeInstruction showPrice={true} cocktailRecipe={cocktail} />
                  </div>
                </div>

                {props.onCocktailSelected != undefined ? (
                  <div className={'card-actions flex flex-row justify-end pt-2'}>
                    <button
                      type="button"
                      disabled={props.selectedCocktails?.includes(cocktail.id) ?? false}
                      className={'btn btn-primary btn-sm'}
                      onClick={() => {
                        props.onCocktailSelected?.(cocktail.id);
                        setSearch('');
                        modalContext.closeModal();
                      }}
                    >
                      Hinzufügen
                    </button>
                  </div>
                ) : (
                  <></>
                )}
              </div>
            </div>
          )) ?? <></>
        )}
      </>
    </div>
  );
}
