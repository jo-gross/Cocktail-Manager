import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '@components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { UserContext } from '@lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import { FaArrowDown, FaArrowUp, FaFileDownload, FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { CocktailRecipeModel } from '../../../../../models/CocktailRecipeModel';
import ImageModal from '../../../../../components/modals/ImageModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import { cocktailFilter } from '@lib/cocktailFilter';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import '../../../../../lib/NumberUtils';

const CocktailsOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipeModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');
  const [selectedCocktailIds, setSelectedCocktailIds] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [chromiumAvailable, setChromiumAvailable] = useState(false);

  const [collapsedArchived, setCollapsedArchived] = useState(true);

  const refreshCocktails = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailRecipes(body.data);
        } else {
          console.error('Cocktails -> fetchCocktails', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktails', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Cocktails -> fetchCocktails', error);
        alertService.error('Fehler beim Laden der Cocktails');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshCocktails();

    // Check if Chromium service is available
    fetch('/api/chromium-status')
      .then((res) => res.json())
      .then((data) => {
        setChromiumAvailable(data.available || false);
      })
      .catch((error) => {
        console.error('Error checking Chromium status:', error);
        setChromiumAvailable(false);
      });
  }, [refreshCocktails]);

  CocktailsOverviewPage.pullToRefresh = () => {
    refreshCocktails();
  };

  const groupedCocktails = _.groupBy(cocktailRecipes, 'isArchived');

  const handleToggleSelectAll = useCallback(() => {
    const visibleCocktails = [
      ...(groupedCocktails['false']?.filter(cocktailFilter(filterString)) || []),
      ...(!collapsedArchived ? groupedCocktails['true']?.filter(cocktailFilter(filterString)) || [] : []),
    ];
    const allSelected = visibleCocktails.every((cocktail) => selectedCocktailIds.has(cocktail.id));
    if (allSelected) {
      setSelectedCocktailIds(new Set());
    } else {
      setSelectedCocktailIds(new Set(visibleCocktails.map((cocktail) => cocktail.id)));
    }
  }, [selectedCocktailIds, filterString, collapsedArchived, groupedCocktails]);

  const handleToggleSelect = useCallback(
    (cocktailId: string) => {
      const newSelected = new Set(selectedCocktailIds);
      if (newSelected.has(cocktailId)) {
        newSelected.delete(cocktailId);
      } else {
        newSelected.add(cocktailId);
      }
      setSelectedCocktailIds(newSelected);
    },
    [selectedCocktailIds],
  );

  const handleExportPdf = useCallback(async () => {
    if (!workspaceId || selectedCocktailIds.size === 0) return;
    setExportingPdf(true);
    try {
      alertService.info('Export gestartet, dies kann einen Moment dauern...');
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cocktailIds: Array.from(selectedCocktailIds) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
        alertService.error(error.message ?? 'Fehler beim Exportieren des PDFs', response.status, response.statusText);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cocktails-export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alertService.success('PDF erfolgreich exportiert');
      setSelectedCocktailIds(new Set());
    } catch (error) {
      console.error('PDF export error:', error);
      alertService.error('Fehler beim Exportieren des PDFs');
    } finally {
      setExportingPdf(false);
    }
  }, [workspaceId, selectedCocktailIds]);

  const renderTableRows = (recipes: CocktailRecipeModel[], isArchived: boolean) => {
    return recipes
      .filter(cocktailFilter(filterString))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cocktailRecipe) => (
        <tr key={cocktailRecipe.id} id={cocktailRecipe.id}>
          {chromiumAvailable && (
            <td>
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selectedCocktailIds.has(cocktailRecipe.id)}
                onChange={() => handleToggleSelect(cocktailRecipe.id)}
              />
            </td>
          )}
          <td>
            <div className="flex items-center space-x-3">
              <div className={'h-12 w-12'}>
                {cocktailRecipe._count.CocktailRecipeImage == 0 ? (
                  <></>
                ) : (
                  <div
                    className="h-12 w-12 cursor-pointer"
                    onClick={() =>
                      modalContext.openModal(<ImageModal image={`/api/workspaces/${cocktailRecipe.workspaceId}/cocktails/${cocktailRecipe.id}/image`} />)
                    }
                  >
                    <AvatarImage src={`/api/workspaces/${cocktailRecipe.workspaceId}/cocktails/${cocktailRecipe.id}/image`} alt={'Cocktail'} />
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className={isArchived ? 'italic' : ''}>
            {cocktailRecipe.name} {isArchived && '(Archiviert)'}
          </td>
          <td className={''}>
            <span className={'whitespace-nowrap'}>{cocktailRecipe.price?.formatPrice() ?? '-'} €</span>
          </td>
          <td className={'flex items-center gap-1'}>
            {cocktailRecipe.tags.map((tag) => (
              <div key={`cocktail-${cocktailRecipe.id}-tags-${tag}`} className={'badge badge-primary'}>
                {tag}
              </div>
            ))}
          </td>
          <td>{cocktailRecipe.glass?.name}</td>
          <td>{cocktailRecipe.garnishes.map((garnish) => garnish.garnish.name).join(', ')}</td>
          <ManageColumn entity={'cocktails'} id={cocktailRecipe.id} name={cocktailRecipe.name} onRefresh={refreshCocktails} />
        </tr>
      ));
  };

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Cocktails'}
      actions={
        <div className={'flex items-center gap-2'}>
          {chromiumAvailable && selectedCocktailIds.size > 0 && (
            <button
              className={'btn btn-outline btn-sm md:btn-md'}
              onClick={handleExportPdf}
              disabled={exportingPdf}
              title="Ausgewählte Cocktails als PDF exportieren"
            >
              {exportingPdf ? <span className={'loading loading-spinner'} /> : <FaFileDownload />}
              Als PDF exportieren ({selectedCocktailIds.size})
            </button>
          )}
          {userContext.isUserPermitted(Role.MANAGER) && (
            <Link href={`/workspaces/${workspaceId}/manage/cocktails/create`}>
              <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
                <FaPlus />
              </div>
            </Link>
          )}
        </div>
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  {chromiumAvailable && (
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={
                          groupedCocktails['false']?.filter(cocktailFilter(filterString)).length > 0 &&
                          groupedCocktails['false']?.filter(cocktailFilter(filterString)).every((cocktail) => selectedCocktailIds.has(cocktail.id)) &&
                          (!collapsedArchived
                            ? groupedCocktails['true']?.filter(cocktailFilter(filterString)).length > 0 &&
                              groupedCocktails['true']?.filter(cocktailFilter(filterString)).every((cocktail) => selectedCocktailIds.has(cocktail.id))
                            : true)
                        }
                        onChange={handleToggleSelectAll}
                        title="Alle auswählen"
                      />
                    </th>
                  )}
                  <th></th>
                  <th>Name</th>
                  <th>Preis</th>
                  <th>Tags</th>
                  <th>Glas</th>
                  <th>Garnitur(en)</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={'w-full'}>
                    <td colSpan={chromiumAvailable ? 8 : 7}>
                      <Loading />
                    </td>
                  </tr>
                ) : (
                  <>
                    {groupedCocktails['false']?.filter(cocktailFilter(filterString)).length == 0 ? (
                      <tr>
                        <td colSpan={chromiumAvailable ? 8 : 7} className={'text-center'}>
                          Keine Cocktails gefunden
                        </td>
                      </tr>
                    ) : (
                      <>{renderTableRows(groupedCocktails['false'] || [], false)}</>
                    )}
                    {(groupedCocktails['true'] || []).filter(cocktailFilter(filterString)).length > 0 && (
                      <>
                        <tr className={'cursor-pointer'} onClick={() => setCollapsedArchived(!collapsedArchived)}>
                          <td colSpan={chromiumAvailable ? 7 : 6} className={'bg-base-100 font-bold'}>
                            Archiviert
                          </td>
                          <td className={'flex items-center justify-end bg-base-100'}>
                            <div className={'p-2'}>{!collapsedArchived ? <FaArrowUp /> : <FaArrowDown />}</div>
                          </td>
                        </tr>
                        {!collapsedArchived && renderTableRows(groupedCocktails['true'], true)}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
};

export default CocktailsOverviewPage;
