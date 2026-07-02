import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FaCheck, FaChevronDown, FaFileDownload, FaFileUpload, FaInfoCircle, FaPlus, FaTimes } from 'react-icons/fa';
import { ManageColumn } from '@components/ManageColumn';
import { UserContext } from '@lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import ListSearchField from '../../../../../components/ListSearchField';
import { IngredientModel } from '../../../../../models/IngredientModel';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { fetchIngredients } from '@lib/network/ingredients';
import ImageModal from '../../../../../components/modals/ImageModal';
import { alertService } from '@lib/alertService';
import EntityImportModal from '../../../../../components/modals/EntityImportModal';
import '../../../../../lib/NumberUtils';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import { normalizeString } from '@lib/StringUtils';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableImageCell,
  TableRow,
  toggleSort,
  useSortableData,
} from '@components/ui';
import type { SortDirection } from '@components/ui';

const IngredientsOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterString, setFilterString] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingSingleId, setExportingSingleId] = useState<string | null>(null);
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

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  }, [workspaceId]);

  IngredientsOverviewPage.pullToRefresh = () => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  };

  const getIngredientSortValue = useCallback((ingredient: IngredientModel, key: string) => {
    switch (key) {
      case 'name':
        return ingredient.name;
      case 'shortName':
        return ingredient.shortName ?? null;
      case 'price':
        return ingredient.price ?? null;
      case 'link':
        return ingredient.link ?? null;
      default:
        return null;
    }
  }, []);

  const filteredIngredients = ingredients.filter(
    (ingredient) =>
      normalizeString(ingredient.name).includes(normalizeString(filterString)) ||
      (ingredient.shortName != null && normalizeString(ingredient.shortName).includes(normalizeString(filterString))) ||
      ingredient.tags.some((tag) => normalizeString(tag).includes(normalizeString(filterString))),
  );

  const sortedIngredients = useSortableData(filteredIngredients, { key: sortKey, direction: sortDirection }, getIngredientSortValue);

  const handleToggleSelect = useCallback(
    (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedIds(newSelected);
    },
    [selectedIds],
  );

  const handleToggleSelectAll = useCallback(() => {
    const allSelected = sortedIngredients.every((i) => selectedIds.has(i.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedIngredients.map((i) => i.id)));
    }
  }, [selectedIds, sortedIngredients]);

  const handleExportJson = useCallback(async () => {
    if (!workspaceId || selectedIds.size === 0) return;
    setExportingJson(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ingredients/export-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
        alertService.error(error.message ?? 'Fehler beim Exportieren');
        return;
      }

      const exportData = await response.json();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ingredients-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alertService.success('JSON erfolgreich exportiert');
      setSelectedIds(new Set());
    } catch (error) {
      console.error('JSON export error:', error);
      alertService.error('Fehler beim Exportieren');
    } finally {
      setExportingJson(false);
    }
  }, [workspaceId, selectedIds]);

  const handleExportSingleJson = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      setExportingSingleId(id);
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/ingredients/export-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
          alertService.error(error.message ?? 'Fehler beim Exportieren');
          return;
        }

        const exportData = await response.json();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ingredientName = ingredients.find((i) => i.id === id)?.name || 'ingredient';
        a.download = `${ingredientName}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alertService.success('JSON erfolgreich exportiert');
      } catch (error) {
        console.error('JSON export error:', error);
        alertService.error('Fehler beim Exportieren');
      } finally {
        setExportingSingleId(null);
      }
    },
    [workspaceId, ingredients],
  );

  return (
    <ManageEntityLayout
      title={'Zutaten'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={
        <div className={'flex items-center gap-2'}>
          {selectedIds.size > 0 && (
            <Dropdown align="end">
              <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
                <FaFileDownload />
                {selectedIds.size} ausgewählt
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
                      Als JSON exportieren ({selectedIds.size})
                    </button>
                  </li>
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
                        <EntityImportModal
                          workspaceId={workspaceId as string}
                          entityType="ingredients"
                          onImportComplete={() => fetchIngredients(workspaceId, setIngredients, setLoading)}
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
            <Link href={`/workspaces/${workspaceId}/manage/ingredients/create`}>
              <Button variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10">
                <FaPlus />
              </Button>
            </Link>
          )}
        </div>
      }
    >
      <Card>
        <CardBody>
          <DataTable toolbar={<ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />}>
            <Table zebra className="w-full">
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-0">
                    <Checkbox
                      checkboxSize="sm"
                      checked={sortedIngredients.length > 0 && sortedIngredients.every((i) => selectedIds.has(i.id))}
                      onChange={handleToggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell className="w-0"></TableHeaderCell>
                  <SortableHeaderCell sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Zutat
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="shortName" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Eigene Bezeichnung
                  </SortableHeaderCell>
                  <TableHeaderCell>Notizen</TableHeaderCell>
                  <SortableHeaderCell sortKey="price" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Preis
                  </SortableHeaderCell>
                  <TableHeaderCell>Verfügbare Menge(n)</TableHeaderCell>
                  <TableHeaderCell>Preis/Menge</TableHeaderCell>
                  <TableHeaderCell>Tags</TableHeaderCell>
                  <SortableHeaderCell sortKey="link" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Link
                  </SortableHeaderCell>
                  <TableHeaderCell>Seite</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={12} avatarColumn={1} />
                ) : sortedIngredients.length == 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center">
                      Keine Einträge gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedIngredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell className="w-0">
                        <Checkbox checkboxSize="sm" checked={selectedIds.has(ingredient.id)} onChange={() => handleToggleSelect(ingredient.id)} />
                      </TableCell>
                      <TableImageCell
                        hasImage={ingredient._count.IngredientImage !== 0}
                        onImageClick={() =>
                          modalContext.openModal(<ImageModal image={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} />)
                        }
                      >
                        <AvatarImage src={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} alt={'Zutat'} />
                      </TableImageCell>
                      <TableCell className={''}>{ingredient.name}</TableCell>
                      <TableCell>{ingredient.shortName}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex flex-row items-center gap-2"
                          onClick={() => {
                            modalContext.openModal(
                              <div className={'flex flex-col gap-2'}>
                                <div className={'mr-8 text-2xl font-bold'}>{ingredient.name}</div>
                                <div className={'text-lg font-bold'}>Allgemeine Zutatenbeschreibung</div>
                                <div className={'long-text-format'}>{ingredient.description ?? '-'}</div>
                                <div className={'text-lg font-bold'}>Notizen</div>
                                <div className={'long-text-format'}>{ingredient.notes ?? '-'}</div>
                              </div>,
                            );
                          }}
                        >
                          <FaInfoCircle />
                          <span>Anzeigen</span>
                        </Button>
                      </TableCell>
                      <TableCell className={'whitespace-nowrap'}>{ingredient.price?.formatPrice() ?? '-'} €</TableCell>
                      <TableCell className={''}>
                        {ingredient.IngredientVolume.map((volume) => (
                          <div key={`ingredient-${ingredient.id}-volume-unit-${volume.id}`} className={'whitespace-nowrap'}>
                            {volume.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')} {userContext.getTranslation(volume.unit.name, 'de')}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {ingredient.IngredientVolume.map((volume) => (
                          <div key={`ingredient-${ingredient.id}-volume-unit-price-${volume.id}`} className={'whitespace-nowrap'}>
                            {((ingredient.price ?? 0) / volume.volume).formatPrice()} €/{userContext.getTranslation(volume.unit.name, 'de')}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {ingredient.tags.map((tag) => (
                          <Badge key={`ingredient-${ingredient.id}-tags-${tag}`} variant="primary" outline size="sm" className="m-1">
                            {tag}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        {ingredient.link
                          ?.replace('https://', '')
                          .replace('http://', '')
                          .replace('www.', '')
                          .substring(0, ingredient.link?.replace('https://', '').replace('http://', '').replace('www.', '').indexOf('/')) ?? ''}
                      </TableCell>
                      <TableCell>
                        {ingredient.link == undefined ? (
                          <div className={'text-red-500'}>
                            <FaTimes />
                          </div>
                        ) : (
                          <div className={'text-success'}>
                            <FaCheck />
                          </div>
                        )}
                      </TableCell>
                      <ManageColumn
                        entity={'ingredients'}
                        id={ingredient.id}
                        name={ingredient.name}
                        onRefresh={() => fetchIngredients(workspaceId, setIngredients, setLoading)}
                        onExportJson={handleExportSingleJson}
                        exportingJson={exportingSingleId === ingredient.id}
                      />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTable>
        </CardBody>
      </Card>
    </ManageEntityLayout>
  );
};

export default IngredientsOverviewPage;
