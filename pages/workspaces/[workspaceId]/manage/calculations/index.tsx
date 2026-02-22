import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Loading } from '@components/Loading';
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
    () => cocktailCalculations.filter((calc) => calc.name.toLowerCase().includes(filterString.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [cocktailCalculations, filterString],
  );

  const groupedCalculations = useMemo(() => {
    const grouped = calculationGroups
      .map((group) => ({
        group,
        items: filteredCalculations.filter((calc) => calc.groupId === group.id),
      }))
      .filter((entry) => entry.items.length > 0);

    const ungrouped = filteredCalculations.filter((calc) => !calc.groupId);
    return { grouped, ungrouped };
  }, [calculationGroups, filteredCalculations]);

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
    const allSelected = filteredCalculations.every((c) => selectedIds.has(c.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCalculations.map((c) => c.id)));
    }
  }, [selectedIds, filteredCalculations]);

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
          <select
            className={'select select-bordered w-full'}
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
          </select>
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
        <input id={'new-calculation-group-name'} className={'input input-bordered w-full'} placeholder={'Gruppenname'} autoFocus />
        <label className={'label cursor-pointer justify-start gap-2'}>
          <input id={'new-calculation-group-expanded'} type={'checkbox'} className={'checkbox checkbox-sm'} />
          <span className={'label-text'}>Standardmäßig aufgeklappt</span>
        </label>
        <button
          type={'button'}
          className={'btn btn-primary'}
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
        </button>
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
            <div className="dropdown dropdown-end">
              <button tabIndex={0} className={'btn btn-outline btn-sm md:btn-md'}>
                <FaFileDownload />
                {selectedIds.size} ausgewählt
                <FaChevronDown />
              </button>
              <ul tabIndex={0} className="menu dropdown-content z-[1] mt-2 w-72 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg">
                <li>
                  <button type="button" className="flex items-center gap-2" onClick={handleExportJson} disabled={exportingJson}>
                    {exportingJson ? <span className={'loading loading-spinner loading-sm'} /> : <FaFileDownload />}
                    Als JSON exportieren ({selectedIds.size})
                  </button>
                </li>
                <li>
                  <button type="button" className="flex items-center gap-2" onClick={() => openAssignGroupModal(Array.from(selectedIds))}>
                    <FaLayerGroup />
                    Gruppe zuordnen ({selectedIds.size})
                  </button>
                </li>
                <li>
                  <button type="button" className="flex items-center gap-2" onClick={() => assignGroup(Array.from(selectedIds), null)}>
                    <FaLayerGroup />
                    Gruppenzuordnung entfernen ({selectedIds.size})
                  </button>
                </li>
                {userContext.isUserPermitted(Role.ADMIN) && (
                  <li>
                    <button type="button" className="flex items-center gap-2 text-error" onClick={handleBulkDelete}>
                      <FaTrashAlt />
                      Löschen ({selectedIds.size})
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className={'btn btn-outline btn-sm md:btn-md'}>
              <FaLayerGroup />
              Gruppen
              <FaChevronDown />
            </button>
            <ul tabIndex={0} className="menu dropdown-content z-[1] mt-2 w-80 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg">
              <li>
                <button type={'button'} className={'flex items-center gap-2'} onClick={openCreateGroupModal}>
                  <FaPlus />
                  Neue Gruppe anlegen
                </button>
              </li>
              <li className={'menu-title'}>
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
                        <button
                          type={'button'}
                          className={'btn btn-ghost btn-xs'}
                          title={'Standardmäßig aufgeklappt'}
                          onClick={() => handleToggleGroupDefaultExpanded(group)}
                        >
                          {group.isDefaultExpanded ? 'Standard: Auf' : 'Standard: Zu'}
                        </button>
                        <button
                          type={'button'}
                          className={'btn btn-ghost btn-xs text-error'}
                          title={`Gruppe "${group.name}" löschen`}
                          onClick={() => handleDeleteGroup(group)}
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className={'btn btn-outline btn-sm md:btn-md'}>
              <FaFileUpload />
              Import
              <FaChevronDown />
            </button>
            <ul tabIndex={0} className="menu dropdown-content z-[1] mt-2 w-52 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg">
              <li>
                <button
                  type="button"
                  className="flex items-center gap-2"
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
            </ul>
          </div>
          <Link href={`/workspaces/${workspaceId}/manage/calculations/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        </div>
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(value) => setFilterString(value)} />
          <div className="overflow-x-auto">
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th className="w-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={filteredCalculations.length > 0 && filteredCalculations.every((c) => selectedIds.has(c.id))}
                      onChange={handleToggleSelectAll}
                      title="Alle auswählen"
                    />
                  </th>
                  <th className="">Name</th>
                  <th className="">Cocktails</th>
                  <th className="">Zuletzt bearbeitet</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={'w-full'}>
                    <td colSpan={5}>
                      <Loading />
                    </td>
                  </tr>
                ) : filteredCalculations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  <>
                    {groupedCalculations.grouped.map(({ group, items }) => (
                      <React.Fragment key={`group-${group.id}`}>
                        <tr className={'bg-base-200'}>
                          <td colSpan={5}>
                            <button type={'button'} className={'btn btn-ghost btn-sm gap-2'} onClick={() => handleToggleGroupCollapsed(group.id)}>
                              {collapsedGroupIds.has(group.id) ? <FaChevronRight /> : <FaChevronDown />}
                              <span className={'font-semibold'}>{group.name}</span>
                              <span className={'opacity-70'}>({items.length})</span>
                            </button>
                          </td>
                        </tr>
                        {!collapsedGroupIds.has(group.id) &&
                          items.map((cocktailCalculation) => (
                            <tr key={cocktailCalculation.id}>
                              <td className="w-0">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={selectedIds.has(cocktailCalculation.id)}
                                  onChange={() => handleToggleSelect(cocktailCalculation.id)}
                                />
                              </td>
                              <td>{cocktailCalculation.name}</td>
                              <td>
                                {cocktailCalculation.cocktailCalculationItems
                                  .map((calculationItem) => calculationItem.cocktail.name)
                                  .sort((a, b) => a.localeCompare(b))
                                  .join(', ')}
                              </td>
                              <td>
                                <div className="flex flex-col leading-tight">
                                  <span>von {cocktailCalculation.updatedByUser.name}</span>
                                  <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
                                </div>
                              </td>
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
                            </tr>
                          ))}
                      </React.Fragment>
                    ))}
                    {groupedCalculations.ungrouped.length > 0 && (
                      <>
                        <tr className={'bg-base-200'}>
                          <td colSpan={5}>
                            <div className={'px-2 py-1 font-semibold'}>Ohne Gruppe ({groupedCalculations.ungrouped.length})</div>
                          </td>
                        </tr>
                        {groupedCalculations.ungrouped.map((cocktailCalculation) => (
                          <tr key={cocktailCalculation.id}>
                            <td className="w-0">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={selectedIds.has(cocktailCalculation.id)}
                                onChange={() => handleToggleSelect(cocktailCalculation.id)}
                              />
                            </td>
                            <td>{cocktailCalculation.name}</td>
                            <td>
                              {cocktailCalculation.cocktailCalculationItems
                                .map((calculationItem) => calculationItem.cocktail.name)
                                .sort((a, b) => a.localeCompare(b))
                                .join(', ')}
                            </td>
                            <td>
                              <div className="flex flex-col leading-tight">
                                <span>von {cocktailCalculation.updatedByUser.name}</span>
                                <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
                              </div>
                            </td>
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
                          </tr>
                        ))}
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

export default CocktailCalculationOverviewPage;
