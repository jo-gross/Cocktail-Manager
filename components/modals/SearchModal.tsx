import { BsSearch } from 'react-icons/bs';
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import CocktailRecipeCardItem from '../cocktails/CocktailRecipeCardItem';
import _ from 'lodash';
import StatisticActions from '../StatisticActions';
import { SearchResultRow } from '../search/SearchResultRow';
import { Button, ButtonGroup, CardActions, Collapse, CollapseContent, CollapseTitle, Input, Loading, Skeleton } from '@components/ui';

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

function SearchSkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`search-skeleton-${index}`} className="flex min-h-14 items-center gap-3 rounded-lg border border-base-300/60 px-4 py-3">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export const SearchModal = forwardRef<SearchModalRef, SearchModalProps>((props, ref) => {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const showRecipe = props.showRecipe ?? true;

  const [search, setSearch] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [archivedOpen, setArchivedOpen] = useState(false);

  const controllerRef = useRef<AbortController>(new AbortController());

  const fetchCocktails = useCallback(
    async (search: string) => {
      if (!workspaceId) return;
      controllerRef.current.abort();
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

  const toggleCard = (cocktailId: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(cocktailId)) {
        next.delete(cocktailId);
      } else {
        next.add(cocktailId);
      }
      return next;
    });
  };

  const handleSelectCocktail = (cocktail: CocktailRecipeFull) => {
    props.onCocktailSelectedObject?.(cocktail);
    if (!props.notAsModal) {
      setSearch('');
      modalContext.closeModal();
    }
  };

  const renderSelectionRow = (cocktail: CocktailRecipeFull, isArchived: boolean) => (
    <SearchResultRow
      key={'search-modal-' + cocktail.id}
      cocktail={cocktail}
      isArchived={isArchived}
      onSelect={handleSelectCocktail}
      actionLabel={props.selectionLabel ?? 'Hinzufügen'}
      actionDisabled={props.selectedCocktails?.includes(cocktail.id) ?? false}
      showAction={props.onCocktailSelectedObject != undefined}
    />
  );

  const renderCocktailCard = (cocktail: CocktailRecipeFull, index: number, isArchived: boolean, openCard: boolean = false) => {
    if (!showRecipe) {
      return renderSelectionRow(cocktail, isArchived);
    }

    const isOpen = openCards.has(cocktail.id) || openCard;

    return (
      <Collapse key={'search-modal-' + cocktail.id} open={isOpen} arrow>
        <CollapseTitle tabIndex={index} className="text-base font-medium md:text-lg" onClick={() => toggleCard(cocktail.id)}>
          <span className="min-w-0 truncate">
            {cocktail.name}
            {isArchived && ' (Archiviert)'}
          </span>
        </CollapseTitle>
        <CollapseContent>
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
            <CardActions className="flex flex-row justify-end py-2">
              <Button
                type="button"
                disabled={props.selectedCocktails?.includes(cocktail.id) ?? false}
                variant="primary"
                size="sm"
                onClick={() => handleSelectCocktail(cocktail)}
              >
                {props.selectionLabel ?? 'Hinzufügen'}
              </Button>
            </CardActions>
          ) : null}

          {props.showStatisticActions ? (
            <div className={'mt-2 pb-2'}>
              <StatisticActions
                workspaceId={router.query.workspaceId as string}
                cocktailId={cocktail.id}
                cocktailName={cocktail.name}
                actionSource={'SEARCH_MODAL'}
              />
            </div>
          ) : null}
        </CollapseContent>
      </Collapse>
    );
  };

  const groupedCocktails = _.groupBy(cocktails, 'isArchived');

  return (
    <div className={`grid w-full grid-cols-1 gap-3 ${props.customWidthClassName ? props.customWidthClassName : 'md:max-w-2xl'}`}>
      <div className={'sticky w-full'}>
        <div className={'w-max text-2xl font-bold'}>Cocktail suchen</div>
        <ButtonGroup className="w-full pb-2">
          <Input
            joinItem
            className="w-full"
            value={search}
            autoFocus={true}
            placeholder="Tippe zum Suchen…"
            onChange={async (e) => {
              setSearch(e.target.value);
              if (e.target.value.trim().length != 0) {
                await fetchCocktails(e.target.value);
              }
            }}
          />
          <Button
            type={'button'}
            joinItem
            disabled={isLoading}
            variant="outline"
            shape={isLoading ? 'default' : 'square'}
            className={isLoading ? 'w-fit px-2' : undefined}
            onClick={async () => {
              await fetchCocktails(search);
            }}
          >
            {isLoading ? <Loading size="xs" /> : null}
            <BsSearch />
          </Button>
        </ButtonGroup>
      </div>
      <div
        className={`${props.notAsModal ? (process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 'h-[calc(100vh-12rem)]' : 'h-[calc(100vh-9.5rem)]') : ''} flex flex-col gap-2 overflow-y-auto`}
      >
        {isLoading && cocktails.length === 0 ? (
          <SearchSkeletonRows />
        ) : cocktails.length == 0 ? (
          search != '' ? (
            <div className="px-1 text-base-content/70">Keine Einträge gefunden</div>
          ) : (
            <div className="px-1 text-base-content/70">Tippe zum Suchen…</div>
          )
        ) : (
          <>
            {groupedCocktails['false']?.length > 0 &&
              groupedCocktails['false']
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cocktail, index) => renderCocktailCard(cocktail, index, false, groupedCocktails['false']?.length == 1))}
            {groupedCocktails['true']?.length > 0 && (
              <Collapse open={archivedOpen} arrow>
                <CollapseTitle className="text-xl font-medium" onClick={() => setArchivedOpen(!archivedOpen)}>
                  Archiviert
                </CollapseTitle>
                <CollapseContent>
                  <div className={'flex flex-col gap-2'}>
                    {groupedCocktails['true'].sort((a, b) => a.name.localeCompare(b.name)).map((cocktail, index) => renderCocktailCard(cocktail, index, true))}
                  </div>
                </CollapseContent>
              </Collapse>
            )}
          </>
        )}
        {isLoading && cocktails.length > 0 ? <SearchSkeletonRows count={3} /> : null}
      </div>
    </div>
  );
});

SearchModal.displayName = 'SearchModal';
