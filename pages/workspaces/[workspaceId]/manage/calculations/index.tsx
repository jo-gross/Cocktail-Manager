import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { CocktailCalculationOverview } from '../../../../../models/CocktailCalculationOverview';
import { Role } from '@generated/prisma/client';
import { FaChevronDown, FaChevronRight, FaFileDownload, FaFileUpload, FaLayerGroup, FaPlus, FaTrashAlt } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import EntityImportModal from '../../../../../components/modals/EntityImportModal';
import { ConfirmActionModal } from '../../../../../components/modals/ConfirmActionModal';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  DataTable,
  Dropdown,
  DropdownContent,
  Input,
  Label,
  LabelText,
  Loading as UiLoading,
  Menu,
  Select,
  SkeletonTableRows,
  SortableHeaderCell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toggleSort,
  Tooltip,
  useSortableData,
} from '@components/ui';
import type { SortDirection } from '@components/ui';

interface CalculationGroup {
  id: string;
  name: string;
  isDefaultExpanded: boolean;
  _count?: { calculations: number };
}

const CocktailCalculationOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [cocktailCalculations, setCocktailCalculations] = useState<CocktailCalculationOverview[]>([]);
  const [calculationGroups, setCalculationGroups] = useState<CalculationGroup[]>([]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
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

  const getCalculationSortValue = useCallback((calc: CocktailCalculationOverview, key: string) => {
    switch (key) {
      case 'name':
        return calc.name;
      case 'cocktails':
        return calc.cocktailCalculationItems.length;
      case 'updatedAt':
        return new Date(calc.updatedAt);
      default:
        return null;
    }
  }, []);

  const formatUpdatedAt = useCallback((dateString: string | Date) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const refreshCocktailCalculations = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([fetch(`/api/workspaces/${workspaceId}/calculations`), fetch(`/api/workspaces/${workspaceId}/calculations/groups`)])
      .then(async ([calculationsResponse, groupsResponse]) => {
        const calculationsBody = await calculationsResponse.json();
        const groupsBody = await groupsResponse.json();

        if (!calculationsResponse.ok) {
          console.error('Calculation -> refreshCocktailCalculations', calculationsResponse);
          alertService.error(calculationsBody.message ?? 'Fehler beim Laden der Kalkulationen', calculationsResponse.status, calculationsResponse.statusText);
          return;
        }
        if (!groupsResponse.ok) {
          console.error('Calculation -> refreshGroups', groupsResponse);
          alertService.error(groupsBody.message ?? 'Fehler beim Laden der Gruppen', groupsResponse.status, groupsResponse.statusText);
          return;
        }

        setCocktailCalculations(calculationsBody.data ?? []);
        const groups = groupsBody.data ?? [];
        setCalculationGroups(groups);
        setCollapsedGroupIds(new Set(groups.filter((g: CalculationGroup) => !g.isDefaultExpanded).map((g: CalculationGroup) => g.id)));
      })
      .catch((error) => {
        console.error('Calculation -> refreshCocktailCalculations', error);
        alertService.error('Fehler beim Laden der Kalkulationen');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshCocktailCalculations();
  }, [refreshCocktailCalculations]);

  CocktailCalculationOverviewPage.pullToRefresh = () => {
    refreshCocktailCalculations();
  };

  const filteredCalculations = useMemo(
    () => cocktailCalculations.filter((calc) => calc.name.toLowerCase().includes(filterString.toLowerCase())),
    [cocktailCalculations, filterString],
  );

  const sortedCalculations = useSortableData(filteredCalculations, { key: sortKey, direction: sortDirection }, getCalculationSortValue);

  const groupedCalculations = useMemo(() => {
    const grouped = calculationGroups
      .map((group) => ({
        group,
        items: sortedCalculations.filter((calc) => calc.groupId === group.id),
      }))
      .filter((entry) => entry.items.length > 0);

    const ungrouped = sortedCalculations.filter((calc) => !calc.groupId);
    return { grouped, ungrouped };
  }, [calculationGroups, sortedCalculations]);

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
    const allSelected = sortedCalculations.every((c) => selectedIds.has(c.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCalculations.map((c) => c.id)));
    }
  }, [selectedIds, sortedCalculations]);

  const handleToggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const assignGroup = useCallback(
    async (calculationIds: string[], groupId: string | null) => {
      if (!workspaceId || calculationIds.length === 0) return;
      const response = await fetch(`/api/workspaces/${workspaceId}/calculations/groups/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calculationIds, groupId }),
      });
      const body = await response.json();
      if (!response.ok) {
        alertService.error(body.message ?? 'Fehler beim Zuordnen der Gruppe', response.status, response.statusText);
        return;
      }
      alertService.success(groupId ? 'Gruppe zugeordnet' : 'Gruppenzuordnung entfernt');
      setSelectedIds(new Set());
      refreshCocktailCalculations();
    },
    [workspaceId, refreshCocktailCalculations],
  );

  const openAssignGroupModal = useCallback(
    (calculationIds: string[]) => {
      if (calculationGroups.length === 0) {
        alertService.error('Bitte zuerst eine Gruppe anlegen');
        return;
      }
      modalContext.openModal(
        <div className={'grid grid-cols-1 gap-3 p-2'}>
          <div className={'text-xl font-bold'}>Gruppe zuordnen</div>
          <Select
            className="w-full"
            defaultValue={''}
            onChange={async (event) => {
              if (event.target.value === '') return;
              await assignGroup(calculationIds, event.target.value);
              modalContext.closeAllModals();
            }}
          >
            <option value={''} disabled>
              Gruppe auswählen
            </option>
            {calculationGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <div className={'text-xs opacity-70'}>Tipp: In der Kalkulation selbst kannst du die Gruppe auch per Suchfeld auswählen.</div>
        </div>,
      );
    },
    [calculationGroups, modalContext, assignGroup],
  );

  const openCreateGroupModal = useCallback(() => {
    if (!workspaceId) return;
    modalContext.openModal(
      <div className={'grid grid-cols-1 gap-3 p-2'}>
        <div className={'text-xl font-bold'}>Neue Gruppe</div>
        <Input id={'new-calculation-group-name'} className="w-full" placeholder={'Gruppenname'} autoFocus />
        <Label className="cursor-pointer flex-row items-center justify-start gap-2">
          <Checkbox id={'new-calculation-group-expanded'} checkboxSize="sm" />
          <LabelText>Standardmäßig aufgeklappt</LabelText>
        </Label>
        <Button
          type={'button'}
          variant="primary"
          onClick={async () => {
            const nameInput = document.getElementById('new-calculation-group-name') as HTMLInputElement | null;
            const expandedInput = document.getElementById('new-calculation-group-expanded') as HTMLInputElement | null;
            const name = nameInput?.value?.trim() ?? '';
            if (!name) {
              alertService.error('Bitte einen Gruppennamen eingeben');
              return;
            }
            const response = await fetch(`/api/workspaces/${workspaceId}/calculations/groups`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, isDefaultExpanded: expandedInput?.checked ?? false }),
            });
            const body = await response.json();
            if (!response.ok) {
              alertService.error(body.message ?? 'Fehler beim Erstellen der Gruppe', response.status, response.statusText);
              return;
            }
            modalContext.closeAllModals();
            alertService.success('Gruppe erstellt');
            refreshCocktailCalculations();
          }}
        >
          Erstellen
        </Button>
      </div>,
    );
  }, [workspaceId, modalContext, refreshCocktailCalculations]);

  const handleToggleGroupDefaultExpanded = useCallback(
    async (group: CalculationGroup) => {
      if (!workspaceId) return;
      const response = await fetch(`/api/workspaces/${workspaceId}/calculations/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: group.name, isDefaultExpanded: !group.isDefaultExpanded }),
      });
      const body = await response.json();
      if (!response.ok) {
        alertService.error(body.message ?? 'Fehler beim Aktualisieren der Gruppe', response.status, response.statusText);
        return;
      }
      refreshCocktailCalculations();
    },
    [workspaceId, refreshCocktailCalculations],
  );

  const handleDeleteGroup = useCallback(
    (group: CalculationGroup) => {
      if (!workspaceId) return;
      modalContext.openModal(
        <ConfirmActionModal
          title={'Gruppe löschen'}
          message={`Soll die Gruppe "${group.name}" gelöscht werden?`}
          confirmLabel={'Löschen'}
          confirmVariant={'error'}
          onConfirm={async () => {
            const response = await fetch(`/api/workspaces/${workspaceId}/calculations/groups/${group.id}`, { method: 'DELETE' });
            const body = await response.json();
            if (!response.ok) {
              alertService.error(body.message ?? 'Fehler beim Löschen der Gruppe', response.status, response.statusText);
              return;
            }
            alertService.success('Gruppe gelöscht');
            refreshCocktailCalculations();
          }}
        />,
      );
    },
    [workspaceId, modalContext, refreshCocktailCalculations],
  );

  const handleExportJson = useCallback(async () => {
    if (!workspaceId || selectedIds.size === 0) return;
    setExportingJson(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/calculations/export-json`, {
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
      a.download = `calculations-export-${new Date().toISOString().split('T')[0]}.json`;
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
        const response = await fetch(`/api/workspaces/${workspaceId}/calculations/export-json`, {
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
        const calcName = cocktailCalculations.find((c) => c.id === id)?.name || 'calculation';
        a.download = `${calcName}-export-${new Date().toISOString().split('T')[0]}.json`;
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
    [workspaceId, cocktailCalculations],
  );

  const handleBulkDelete = useCallback(() => {
    if (!workspaceId || selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    modalContext.openModal(
      <ConfirmActionModal
        title="Löschen"
        message={`Möchtest du die ${count} ausgewählte${count === 1 ? '' : 'n'} Kalkulation${count === 1 ? '' : 'en'} wirklich löschen?`}
        confirmLabel="Löschen"
        confirmVariant="error"
        onConfirm={async () => {
          for (const id of ids) {
            const res = await fetch(`/api/workspaces/${workspaceId}/calculations/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Löschen fehlgeschlagen');
          }
          setSelectedIds(new Set());
          refreshCocktailCalculations();
          alertService.success(`${count} Kalkulation${count === 1 ? '' : 'en'} gelöscht`);
        }}
      />,
    );
  }, [workspaceId, selectedIds, modalContext, refreshCocktailCalculations]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Kalkulationen'}
      actions={
        <div className={'flex items-center gap-2'}>
          {selectedIds.size > 0 && (
            <Dropdown align="end">
              <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
                <FaFileDownload />
                {selectedIds.size} ausgewählt
                <FaChevronDown />
              </Button>
              <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-72">
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
                  <li>
                    <button type="button" onClick={() => openAssignGroupModal(Array.from(selectedIds))}>
                      <FaLayerGroup />
                      Gruppe zuordnen ({selectedIds.size})
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => assignGroup(Array.from(selectedIds), null)}>
                      <FaLayerGroup />
                      Gruppenzuordnung entfernen ({selectedIds.size})
                    </button>
                  </li>
                  {userContext.isUserPermitted(Role.ADMIN) && (
                    <li>
                      <button type="button" className="text-error" onClick={handleBulkDelete}>
                        <FaTrashAlt />
                        Löschen ({selectedIds.size})
                      </button>
                    </li>
                  )}
                </Menu>
              </DropdownContent>
            </Dropdown>
          )}
          <Dropdown align="end">
            <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
              <FaLayerGroup />
              Gruppen
              <FaChevronDown />
            </Button>
            <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-80">
              <Menu
                size="sm"
                className="gap-1 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-field [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:hover:bg-base-200"
              >
                <li>
                  <button type={'button'} onClick={openCreateGroupModal}>
                    <FaPlus />
                    Neue Gruppe anlegen
                  </button>
                </li>
                <li className="pointer-events-none px-3 py-1 text-xs font-semibold uppercase opacity-60">
                  <span>Vorhandene Gruppen</span>
                </li>
                {calculationGroups.length === 0 ? (
                  <li>
                    <span className={'opacity-70'}>Noch keine Gruppen vorhanden</span>
                  </li>
                ) : (
                  calculationGroups.map((group) => (
                    <li key={group.id}>
                      <div className={'flex items-center justify-between gap-2'}>
                        <span className={'truncate'}>{group.name}</span>
                        <div className={'flex items-center gap-1'}>
                          <Button type={'button'} variant="ghost" size="xs" onClick={() => handleToggleGroupDefaultExpanded(group)}>
                            {group.isDefaultExpanded ? 'Standard: Auf' : 'Standard: Zu'}
                          </Button>
                          <Tooltip tip={`Gruppe "${group.name}" löschen`}>
                            <Button type={'button'} variant="ghost" size="xs" className="text-error" onClick={() => handleDeleteGroup(group)}>
                              <FaTrashAlt />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </Menu>
            </DropdownContent>
          </Dropdown>
          <Dropdown align="end">
            <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
              <FaFileUpload />
              Import
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
                        <EntityImportModal workspaceId={workspaceId as string} entityType="calculations" onImportComplete={refreshCocktailCalculations} />,
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
          <Link href={`/workspaces/${workspaceId}/manage/calculations/create`}>
            <Button variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10">
              <FaPlus />
            </Button>
          </Link>
        </div>
      }
      fullHeight
    >
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardBody className="min-h-0 flex-1">
          <DataTable fillHeight toolbar={<ListSearchField onFilterChange={(value) => setFilterString(value)} />}>
            <Table zebra className="w-full">
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-0">
                    <Checkbox
                      checkboxSize="sm"
                      checked={sortedCalculations.length > 0 && sortedCalculations.every((c) => selectedIds.has(c.id))}
                      onChange={handleToggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </TableHeaderCell>
                  <SortableHeaderCell sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Name
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="cocktails" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Cocktails
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="updatedAt" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    Zuletzt bearbeitet
                  </SortableHeaderCell>
                  <TableHeaderCell className="flex justify-end"></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={5} avatarColumn={-1} />
                ) : sortedCalculations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {groupedCalculations.grouped.map(({ group, items }) => (
                      <React.Fragment key={`group-${group.id}`}>
                        <TableRow className={'bg-base-200'}>
                          <TableCell colSpan={5}>
                            <Button type={'button'} variant="ghost" size="sm" className="gap-2" onClick={() => handleToggleGroupCollapsed(group.id)}>
                              {collapsedGroupIds.has(group.id) ? <FaChevronRight /> : <FaChevronDown />}
                              <span className={'font-semibold'}>{group.name}</span>
                              <span className={'opacity-70'}>({items.length})</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                        {!collapsedGroupIds.has(group.id) &&
                          items.map((cocktailCalculation) => (
                            <TableRow key={cocktailCalculation.id}>
                              <TableCell className="w-0">
                                <Checkbox
                                  checkboxSize="sm"
                                  checked={selectedIds.has(cocktailCalculation.id)}
                                  onChange={() => handleToggleSelect(cocktailCalculation.id)}
                                />
                              </TableCell>
                              <TableCell>{cocktailCalculation.name}</TableCell>
                              <TableCell>
                                {cocktailCalculation.cocktailCalculationItems
                                  .map((calculationItem) => calculationItem.cocktail.name)
                                  .sort((a, b) => a.localeCompare(b))
                                  .join(', ')}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col leading-tight">
                                  <span>von {cocktailCalculation.updatedByUser.name}</span>
                                  <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
                                </div>
                              </TableCell>
                              <ManageColumn
                                entity={'calculations'}
                                name={cocktailCalculation.name}
                                id={cocktailCalculation.id}
                                onRefresh={refreshCocktailCalculations}
                                editRole={Role.USER}
                                deleteRole={Role.ADMIN}
                                onExportJson={handleExportSingleJson}
                                exportingJson={exportingSingleId === cocktailCalculation.id}
                                customActions={[
                                  {
                                    label: 'Gruppe zuordnen',
                                    icon: <FaLayerGroup />,
                                    onClick: (id) => openAssignGroupModal([id]),
                                  },
                                  {
                                    label: 'Gruppenzuordnung entfernen',
                                    icon: <FaLayerGroup />,
                                    onClick: (id) => assignGroup([id], null),
                                  },
                                ]}
                              />
                            </TableRow>
                          ))}
                      </React.Fragment>
                    ))}
                    {groupedCalculations.ungrouped.length > 0 && (
                      <>
                        <TableRow className={'bg-base-200'}>
                          <TableCell colSpan={5}>
                            <div className={'px-2 py-1 font-semibold'}>Ohne Gruppe ({groupedCalculations.ungrouped.length})</div>
                          </TableCell>
                        </TableRow>
                        {groupedCalculations.ungrouped.map((cocktailCalculation) => (
                          <TableRow key={cocktailCalculation.id}>
                            <TableCell className="w-0">
                              <Checkbox
                                checkboxSize="sm"
                                checked={selectedIds.has(cocktailCalculation.id)}
                                onChange={() => handleToggleSelect(cocktailCalculation.id)}
                              />
                            </TableCell>
                            <TableCell>{cocktailCalculation.name}</TableCell>
                            <TableCell>
                              {cocktailCalculation.cocktailCalculationItems
                                .map((calculationItem) => calculationItem.cocktail.name)
                                .sort((a, b) => a.localeCompare(b))
                                .join(', ')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col leading-tight">
                                <span>von {cocktailCalculation.updatedByUser.name}</span>
                                <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
                              </div>
                            </TableCell>
                            <ManageColumn
                              entity={'calculations'}
                              name={cocktailCalculation.name}
                              id={cocktailCalculation.id}
                              onRefresh={refreshCocktailCalculations}
                              editRole={Role.USER}
                              deleteRole={Role.ADMIN}
                              onExportJson={handleExportSingleJson}
                              exportingJson={exportingSingleId === cocktailCalculation.id}
                              customActions={[
                                {
                                  label: 'Gruppe zuordnen',
                                  icon: <FaLayerGroup />,
                                  onClick: (id) => openAssignGroupModal([id]),
                                },
                              ]}
                            />
                          </TableRow>
                        ))}
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

export default CocktailCalculationOverviewPage;
