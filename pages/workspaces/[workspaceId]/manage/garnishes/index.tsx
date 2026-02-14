import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '@components/Loading';
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

  useEffect(() => {
    fetchGarnishes(workspaceId, setGarnishes, setLoading);
  }, [workspaceId]);

  ManageGarnishesOverviewPage.pullToRefresh = () => {
    fetchGarnishes(workspaceId, setGarnishes, setLoading);
  };

  const filteredGarnishes = garnishes
    .filter((garnish) => garnish.name.toLowerCase().includes(filterString.toLowerCase()))
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
    const allSelected = filteredGarnishes.every((g) => selectedIds.has(g.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGarnishes.map((g) => g.id)));
    }
  }, [selectedIds, filteredGarnishes]);

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
            </ul>
          </div>
          {userContext.isUserPermitted(Role.MANAGER) && (
            <Link href={`/workspaces/${workspaceId}/manage/garnishes/create`}>
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
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th className="w-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={filteredGarnishes.length > 0 && filteredGarnishes.every((g) => selectedIds.has(g.id))}
                      onChange={handleToggleSelectAll}
                      title="Alle auswählen"
                    />
                  </th>
                  <th className="w-0"></th>
                  <th className="">Name</th>
                  <th className="">Preis</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <Loading />
                    </td>
                  </tr>
                ) : filteredGarnishes.length == 0 ? (
                  <tr>
                    <td colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  filteredGarnishes.map((garnish) => (
                    <tr className={'p-4'} key={garnish.id}>
                      <td className="w-0">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedIds.has(garnish.id)}
                          onChange={() => handleToggleSelect(garnish.id)}
                        />
                      </td>
                      <td className="w-0 p-0">
                        {garnish._count.GarnishImage !== 0 && (
                          <div
                            className="h-12 w-12 cursor-pointer"
                            onClick={() =>
                              modalContext.openModal(<ImageModal image={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} />)
                            }
                          >
                            <AvatarImage src={`/api/workspaces/${garnish.workspaceId}/garnishes/${garnish.id}/image`} alt="Garnitur" />
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-bold">{garnish.name}</div>
                      </td>
                      <td>{garnish.price?.formatPrice() ?? '-'} €</td>
                      <ManageColumn
                        entity={'garnishes'}
                        id={garnish.id}
                        name={garnish.name}
                        onRefresh={() => fetchGarnishes(workspaceId, setGarnishes, setLoading)}
                        onExportJson={handleExportSingleJson}
                        exportingJson={exportingSingleId === garnish.id}
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

export default ManageGarnishesOverviewPage;
