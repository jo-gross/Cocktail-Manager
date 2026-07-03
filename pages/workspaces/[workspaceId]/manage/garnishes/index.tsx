import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { FaChevronDown, FaFileDownload, FaFileUpload, FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { GarnishModel } from '../../../../../models/GarnishModel';
import AvatarImage from '../../../../../components/AvatarImage';
import { fetchGarnishes } from '@lib/network/garnishes';
import ImageModal from '../../../../../components/modals/ImageModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import EntityImportModal from '../../../../../components/modals/EntityImportModal';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import '../../../../../lib/NumberUtils';
import {
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

const ManageGarnishesOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [garnishes, setGarnishes] = useState<GarnishModel[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getGarnishSortValue = useCallback((garnish: GarnishModel, key: string) => (key === 'price' ? (garnish.price ?? null) : garnish.name), []);

  const filteredGarnishes = garnishes.filter((garnish) => garnish.name.toLowerCase().includes(filterString.toLowerCase()));
  const sortedGarnishes = useSortableData(filteredGarnishes, { key: sortKey, direction: sortDirection }, getGarnishSortValue);

  useEffect(() => {
    fetchGarnishes(workspaceId, setGarnishes, setLoading);
  }, [workspaceId]);

  ManageGarnishesOverviewPage.pullToRefresh = () => {
    fetchGarnishes(workspaceId, setGarnishes, setLoading);
  };

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
    const allSelected = sortedGarnishes.every((g) => selectedIds.has(g.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedGarnishes.map((g) => g.id)));
    }
  }, [selectedIds, sortedGarnishes]);

  const handleExportJson = useCallback(async () => {
    if (!workspaceId || selectedIds.size === 0) return;
    setExportingJson(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/garnishes/export-json`, {
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
      a.download = `garnishes-export-${new Date().toISOString().split('T')[0]}.json`;
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
        const response = await fetch(`/api/workspaces/${workspaceId}/garnishes/export-json`, {
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
        const garnishName = garnishes.find((g) => g.id === id)?.name || 'garnish';
        a.download = `${garnishName}-export-${new Date().toISOString().split('T')[0]}.json`;
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
    [workspaceId, garnishes],
  );

  return (
    <ManageEntityLayout
      title={'Garnituren'}
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
                          entityType="garnishes"
                          onImportComplete={() => fetchGarnishes(workspaceId, setGarnishes, setLoading)}
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
            <Link href={`/workspaces/${workspaceId}/manage/garnishes/create`}>
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
                  <TableHeaderCell className="w-0">
                    <Checkbox
                      checkboxSize="sm"
                      checked={sortedGarnishes.length > 0 && sortedGarnishes.every((g) => selectedIds.has(g.id))}
                      onChange={handleToggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell className="w-0"></TableHeaderCell>
                  <SortableHeaderCell sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Name
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="price" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Preis
                  </SortableHeaderCell>
                  <TableHeaderCell className="flex justify-end"></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={5} avatarColumn={1} />
                ) : sortedGarnishes.length == 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedGarnishes.map((garnish) => (
                    <TableRow key={garnish.id}>
                      <TableCell className="w-0">
                        <Checkbox checkboxSize="sm" checked={selectedIds.has(garnish.id)} onChange={() => handleToggleSelect(garnish.id)} />
                      </TableCell>
                      <TableImageCell
                        hasImage={garnish._count.GarnishImage !== 0}
                        onImageClick={() =>
                          modalContext.openModal(<ImageModal image={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} />)
                        }
                      >
                        <AvatarImage src={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} alt="Garnitur" />
                      </TableImageCell>
                      <TableCell>
                        <div className="font-bold">{garnish.name}</div>
                      </TableCell>
                      <TableCell>{garnish.price?.formatPrice() ?? '-'} €</TableCell>
                      <ManageColumn
                        entity={'garnishes'}
                        id={garnish.id}
                        name={garnish.name}
                        onRefresh={() => fetchGarnishes(workspaceId, setGarnishes, setLoading)}
                        onExportJson={handleExportSingleJson}
                        exportingJson={exportingSingleId === garnish.id}
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

export default ManageGarnishesOverviewPage;
