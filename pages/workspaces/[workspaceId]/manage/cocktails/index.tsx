import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { UserContext } from '@lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaFileDownload, FaFileUpload, FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { CocktailRecipeModel } from '../../../../../models/CocktailRecipeModel';
import ImageModal from '../../../../../components/modals/ImageModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import { cocktailFilter } from '@lib/cocktailFilter';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import '../../../../../lib/NumberUtils';
import CocktailExportOptionsModal, { CocktailExportOptions } from '../../../../../components/modals/CocktailExportOptionsModal';
import CocktailImportWizardModal from '../../../../../components/modals/CocktailImportWizardModal';
import { ConfirmActionModal } from '../../../../../components/modals/ConfirmActionModal';
import { FaArchive } from 'react-icons/fa';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  DataTable,
  Dropdown,
  DropdownContent,
  Loading as UiLoading,
  Menu,
  SkeletonTableRows,
  SortableHeaderCell,
  sortRows,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableImageCell,
  TableRow,
  toggleSort,
} from '@components/ui';
import type { SortDirection } from '@components/ui';

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
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingSingleId, setExportingSingleId] = useState<{ id: string; type: 'json' | 'pdf' } | null>(null);
  const [chromiumAvailable, setChromiumAvailable] = useState(false);

  const [collapsedArchived, setCollapsedArchived] = useState(true);
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = useCallback(
    (key: string) => {
      const next = toggleSort(sortKey, sortDirection, key);
      setSortKey(next.key);
      setSortDirection(next.direction);
    },
    [sortKey, sortDirection],
  );

  const getCocktailSortValue = useCallback((recipe: CocktailRecipeModel, key: string) => {
    switch (key) {
      case 'name':
        return recipe.name;
      case 'price':
        return recipe.price ?? null;
      case 'glass':
        return recipe.glass?.name ?? null;
      default:
        return null;
    }
  }, []);

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

  const handleBulkArchive = useCallback(() => {
    if (!workspaceId || selectedCocktailIds.size === 0) return;
    const count = selectedCocktailIds.size;
    const ids = Array.from(selectedCocktailIds);
    modalContext.openModal(
      <ConfirmActionModal
        title="Archivieren"
        message={`Möchtest du die ${count} ausgewählten Cocktail${count === 1 ? '' : 's'} wirklich archivieren?`}
        confirmLabel="Archivieren"
        confirmVariant="primary"
        onConfirm={async () => {
          for (const id of ids) {
            const res = await fetch(`/api/workspaces/${workspaceId}/cocktails/${id}/archive`, { method: 'PUT' });
            if (!res.ok) throw new Error('Archivieren fehlgeschlagen');
          }
          setSelectedCocktailIds(new Set());
          refreshCocktails();
          alertService.success(`${count} Cocktail${count === 1 ? '' : 's'} archiviert`);
        }}
      />,
    );
  }, [workspaceId, selectedCocktailIds, modalContext, refreshCocktails]);

  const handleExportPdf = useCallback(() => {
    if (!workspaceId || selectedCocktailIds.size === 0) return;
    modalContext.openModal(
      <CocktailExportOptionsModal
        onExport={async (options: CocktailExportOptions) => {
          setExportingPdf(true);
          try {
            alertService.info('Export läuft und wird gleich zur Verfügung stehen. Dieser Vorgang kann je nach Anzahl der Rezepte einige Minuten dauern.');
            const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                cocktailIds: Array.from(selectedCocktailIds),
                exportImage: options.exportImage,
                exportDescription: options.exportDescription,
                exportNotes: options.exportNotes,
                exportHistory: options.exportHistory,
                newPagePerCocktail: options.newPagePerCocktail,
                showHeader: options.showHeader,
                showFooter: options.showFooter,
              }),
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
        }}
      />,
    );
  }, [workspaceId, selectedCocktailIds, modalContext]);

  const handleExportJson = useCallback(async () => {
    if (!workspaceId || selectedCocktailIds.size === 0) return;
    setExportingJson(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cocktailIds: Array.from(selectedCocktailIds),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
        alertService.error(error.message ?? 'Fehler beim Exportieren des JSON', response.status, response.statusText);
        return;
      }

      const exportData = await response.json();
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `cocktails-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alertService.success('JSON erfolgreich exportiert');
      setSelectedCocktailIds(new Set());
    } catch (error) {
      console.error('JSON export error:', error);
      alertService.error('Fehler beim Exportieren des JSON');
    } finally {
      setExportingJson(false);
    }
  }, [workspaceId, selectedCocktailIds]);

  const handleExportSingleJson = useCallback(
    async (cocktailId: string) => {
      if (!workspaceId) return;
      setExportingSingleId({ id: cocktailId, type: 'json' });
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cocktailIds: [cocktailId],
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
          alertService.error(error.message ?? 'Fehler beim Exportieren des JSON', response.status, response.statusText);
          return;
        }

        const exportData = await response.json();
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        const cocktailName = cocktailRecipes.find((c) => c.id === cocktailId)?.name || 'cocktail';
        a.download = `${cocktailName}-export-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alertService.success('JSON erfolgreich exportiert');
      } catch (error) {
        console.error('JSON export error:', error);
        alertService.error('Fehler beim Exportieren des JSON');
      } finally {
        setExportingSingleId(null);
      }
    },
    [workspaceId, cocktailRecipes],
  );

  const handleExportSinglePdf = useCallback(
    (cocktailId: string) => {
      if (!workspaceId) return;
      modalContext.openModal(
        <CocktailExportOptionsModal
          onExport={async (options: CocktailExportOptions) => {
            setExportingSingleId({ id: cocktailId, type: 'pdf' });
            try {
              alertService.info('Export läuft und wird gleich zur Verfügung stehen.');
              const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-pdf`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cocktailIds: [cocktailId],
                  exportImage: options.exportImage,
                  exportDescription: options.exportDescription,
                  exportNotes: options.exportNotes,
                  exportHistory: options.exportHistory,
                  newPagePerCocktail: options.newPagePerCocktail,
                  showHeader: options.showHeader,
                  showFooter: options.showFooter,
                }),
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
              const cocktailName = cocktailRecipes.find((c) => c.id === cocktailId)?.name || 'cocktail';
              a.download = `${cocktailName}-export-${Date.now()}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              alertService.success('PDF erfolgreich exportiert');
            } catch (error) {
              console.error('PDF export error:', error);
              alertService.error('Fehler beim Exportieren des PDFs');
            } finally {
              setExportingSingleId(null);
            }
          }}
        />,
      );
    },
    [workspaceId, modalContext, cocktailRecipes],
  );

  const renderTableRows = (recipes: CocktailRecipeModel[], isArchived: boolean) => {
    return sortRows(recipes.filter(cocktailFilter(filterString)), { key: sortKey, direction: sortDirection }, getCocktailSortValue).map((cocktailRecipe) => (
      <TableRow key={cocktailRecipe.id} id={cocktailRecipe.id}>
        {chromiumAvailable && (
          <TableCell className="w-0">
            <Checkbox checkboxSize="sm" checked={selectedCocktailIds.has(cocktailRecipe.id)} onChange={() => handleToggleSelect(cocktailRecipe.id)} />
          </TableCell>
        )}
        <TableImageCell
          hasImage={cocktailRecipe._count.CocktailRecipeImage !== 0}
          onImageClick={() =>
            modalContext.openModal(<ImageModal image={`/api/workspaces/${cocktailRecipe.workspaceId}/cocktails/${cocktailRecipe.id}/image`} />)
          }
        >
          <AvatarImage src={`/api/workspaces/${cocktailRecipe.workspaceId}/cocktails/${cocktailRecipe.id}/image`} alt={'Cocktail'} />
        </TableImageCell>
        <TableCell className={isArchived ? 'italic' : ''}>
          {cocktailRecipe.name} {isArchived && '(Archiviert)'}
        </TableCell>
        <TableCell>
          <span className={'whitespace-nowrap'}>{cocktailRecipe.price?.formatPrice() ?? '-'} €</span>
        </TableCell>
        <TableCell className={'flex items-center gap-1'}>
          {cocktailRecipe.tags.map((tag) => (
            <Badge key={`cocktail-${cocktailRecipe.id}-tags-${tag}`} variant="primary">
              {tag}
            </Badge>
          ))}
        </TableCell>
        <TableCell>{cocktailRecipe.glass?.name}</TableCell>
        <TableCell>{cocktailRecipe.garnishes.map((garnish) => garnish.garnish.name).join(', ')}</TableCell>
        <ManageColumn
          entity={'cocktails'}
          id={cocktailRecipe.id}
          name={cocktailRecipe.name}
          onRefresh={refreshCocktails}
          onExportJson={handleExportSingleJson}
          onExportPdf={chromiumAvailable ? handleExportSinglePdf : undefined}
          exportingJson={exportingSingleId?.id === cocktailRecipe.id && exportingSingleId.type === 'json'}
          exportingPdf={exportingSingleId?.id === cocktailRecipe.id && exportingSingleId.type === 'pdf'}
        />
      </TableRow>
    ));
  };

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Cocktails'}
      actions={
        <div className={'flex items-center gap-2'}>
          {selectedCocktailIds.size > 0 && (
            <Dropdown align="end">
              <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
                <FaFileDownload />
                {selectedCocktailIds.size} ausgewählt
                <FaChevronDown />
              </Button>
              <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-64">
                <Menu
                  size="sm"
                  className="gap-1 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-field [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:hover:bg-base-200"
                >
                  <li>
                    <button type="button" onClick={handleExportJson} disabled={exportingJson}>
                      {exportingJson ? <UiLoading size="sm" /> : <FaFileDownload />}
                      Als JSON exportieren ({selectedCocktailIds.size})
                    </button>
                  </li>
                  {chromiumAvailable && (
                    <li>
                      <button type="button" onClick={handleExportPdf} disabled={exportingPdf}>
                        {exportingPdf ? <UiLoading size="sm" /> : <FaFileDownload />}
                        Als PDF exportieren ({selectedCocktailIds.size})
                      </button>
                    </li>
                  )}
                  {userContext.isUserPermitted(Role.MANAGER) && (
                    <li>
                      <button type="button" onClick={handleBulkArchive}>
                        <FaArchive />
                        Archivieren ({selectedCocktailIds.size})
                      </button>
                    </li>
                  )}
                </Menu>
              </DropdownContent>
            </Dropdown>
          )}
          <Dropdown align="end">
            <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
              <FaFileUpload />
              Import/Export
              <FaChevronDown />
            </Button>
            <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-52">
              <Menu
                size="sm"
                className="gap-1 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-field [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:hover:bg-base-200"
              >
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (!workspaceId) return;
                      modalContext.openModal(
                        <CocktailImportWizardModal
                          workspaceId={workspaceId as string}
                          onImportComplete={() => {
                            refreshCocktails();
                          }}
                        />,
                      );
                    }}
                  >
                    <FaFileUpload />
                    Aus JSON importieren
                  </button>
                </li>
              </Menu>
            </DropdownContent>
          </Dropdown>
          {userContext.isUserPermitted(Role.MANAGER) && (
            <Link href={`/workspaces/${workspaceId}/manage/cocktails/create`}>
              <Button variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10">
                <FaPlus />
              </Button>
            </Link>
          )}
        </div>
      }
      fullHeight
    >
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardBody className="min-h-0 flex-1">
          <DataTable fillHeight toolbar={<ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />}>
            <Table zebra className="w-full">
              <TableHead>
                <TableRow>
                  {chromiumAvailable && (
                    <TableHeaderCell className="w-0">
                      <Checkbox
                        checkboxSize="sm"
                        checked={
                          groupedCocktails['false']?.filter(cocktailFilter(filterString)).length > 0 &&
                          groupedCocktails['false']?.filter(cocktailFilter(filterString)).every((cocktail) => selectedCocktailIds.has(cocktail.id)) &&
                          (!collapsedArchived
                            ? groupedCocktails['true']?.filter(cocktailFilter(filterString)).length > 0 &&
                              groupedCocktails['true']?.filter(cocktailFilter(filterString)).every((cocktail) => selectedCocktailIds.has(cocktail.id))
                            : true)
                        }
                        onChange={handleToggleSelectAll}
                        aria-label="Alle auswählen"
                      />
                    </TableHeaderCell>
                  )}
                  <TableHeaderCell className="w-0"></TableHeaderCell>
                  <SortableHeaderCell sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Name
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="price" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Preis
                  </SortableHeaderCell>
                  <TableHeaderCell>Tags</TableHeaderCell>
                  <SortableHeaderCell sortKey="glass" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Glas
                  </SortableHeaderCell>
                  <TableHeaderCell>Garnitur(en)</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={chromiumAvailable ? 8 : 7} avatarColumn={chromiumAvailable ? 1 : 0} />
                ) : (
                  <>
                    {groupedCocktails['false']?.filter(cocktailFilter(filterString)).length == 0 ? (
                      <TableRow>
                        <TableCell colSpan={chromiumAvailable ? 8 : 7} className={'text-center'}>
                          Keine Cocktails gefunden
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>{renderTableRows(groupedCocktails['false'] || [], false)}</>
                    )}
                    {(groupedCocktails['true'] || []).filter(cocktailFilter(filterString)).length > 0 && (
                      <>
                        <TableRow className={'cursor-pointer'} onClick={() => setCollapsedArchived(!collapsedArchived)}>
                          <TableCell colSpan={chromiumAvailable ? 7 : 6} className={'bg-base-100 font-bold'}>
                            Archiviert
                          </TableCell>
                          <TableCell className={'flex items-center justify-end bg-base-100'}>
                            <div className={'p-2'}>{!collapsedArchived ? <FaArrowUp /> : <FaArrowDown />}</div>
                          </TableCell>
                        </TableRow>
                        {!collapsedArchived && renderTableRows(groupedCocktails['true'], true)}
                      </>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </DataTable>
        </CardBody>
      </Card>
    </ManageEntityLayout>
  );
};

export default CocktailsOverviewPage;
