import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '@components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { CocktailCalculationOverview } from '../../../../../models/CocktailCalculationOverview';
import { Role } from '@generated/prisma/client';
import { FaChevronDown, FaFileDownload, FaFileUpload, FaPlus, FaTrashAlt } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import EntityImportModal from '../../../../../components/modals/EntityImportModal';
import { ConfirmActionModal } from '../../../../../components/modals/ConfirmActionModal';
import { NextPageWithPullToRefresh } from '../../../../../types/next';

const CocktailCalculationOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [cocktailCalculations, setCocktailCalculations] = useState<CocktailCalculationOverview[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingSingleId, setExportingSingleId] = useState<string | null>(null);

  const refreshCocktailCalculations = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/calculations`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailCalculations(body.data);
        } else {
          console.error('Calculation -> refreshCocktailCalculations', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Kalkulationen', response.status, response.statusText);
        }
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

  const filteredCalculations = cocktailCalculations
    .filter((calc) => calc.name.toLowerCase().includes(filterString.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

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
              <ul tabIndex={0} className="menu dropdown-content z-[1] mt-2 w-64 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg">
                <li>
                  <button type="button" className="flex items-center gap-2" onClick={handleExportJson} disabled={exportingJson}>
                    {exportingJson ? <span className={'loading loading-spinner loading-sm'} /> : <FaFileDownload />}
                    Als JSON exportieren ({selectedIds.size})
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
              <FaFileUpload />
              Import/Export
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
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
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
                  <th className="">Bearbeitet von</th>
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
                ) : filteredCalculations.length == 0 ? (
                  <tr>
                    <td colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  filteredCalculations.map((cocktailCalculation) => (
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
                      <td>{cocktailCalculation.updatedByUser.name}</td>
                      <ManageColumn
                        entity={'calculations'}
                        name={cocktailCalculation.name}
                        id={cocktailCalculation.id}
                        onRefresh={refreshCocktailCalculations}
                        editRole={Role.USER}
                        deleteRole={Role.ADMIN}
                        onExportJson={handleExportSingleJson}
                        exportingJson={exportingSingleId === cocktailCalculation.id}
                      />
                    </tr>
                  ))
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
