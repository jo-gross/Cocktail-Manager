import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '@components/Loading';
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

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  }, [workspaceId]);

  IngredientsOverviewPage.pullToRefresh = () => {
    fetchIngredients(workspaceId, setIngredients, setLoading);
  };

  const filteredIngredients = ingredients
    .filter(
      (ingredient) =>
        normalizeString(ingredient.name).includes(normalizeString(filterString)) ||
        (ingredient.shortName != null && normalizeString(ingredient.shortName).includes(normalizeString(filterString))) ||
        ingredient.tags.some((tag) => normalizeString(tag).includes(normalizeString(filterString))),
    )
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
    const allSelected = filteredIngredients.every((i) => selectedIds.has(i.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIngredients.map((i) => i.id)));
    }
  }, [selectedIds, filteredIngredients]);

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
            </ul>
          </div>
          {userContext.isUserPermitted(Role.MANAGER) && (
            <Link href={`/workspaces/${workspaceId}/manage/ingredients/create`}>
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
                      checked={filteredIngredients.length > 0 && filteredIngredients.every((i) => selectedIds.has(i.id))}
                      onChange={handleToggleSelectAll}
                      title="Alle auswählen"
                    />
                  </th>
                  <th className="w-0"></th>
                  <th>Zutat</th>
                  <th>Eigene Bezeichnung</th>
                  <th>Notizen</th>
                  <th>Preis</th>
                  <th>Verfügbare Menge(n)</th>
                  <th>Preis/Menge</th>
                  <th>Tags</th>
                  <th>Link</th>
                  <th>Seite</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12}>
                      <Loading />
                    </td>
                  </tr>
                ) : filteredIngredients.length == 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center">
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map((ingredient) => (
                    <tr key={ingredient.id}>
                      <td className="w-0">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedIds.has(ingredient.id)}
                          onChange={() => handleToggleSelect(ingredient.id)}
                        />
                      </td>
                      <td className="w-0 p-0">
                        {ingredient._count.IngredientImage !== 0 && (
                          <div
                            className="h-12 w-12 cursor-pointer"
                            onClick={() =>
                              modalContext.openModal(<ImageModal image={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} />)
                            }
                          >
                            <AvatarImage src={`/api/workspaces/${ingredient.workspaceId}/ingredients/${ingredient.id}/image`} alt={'Zutat'} />
                          </div>
                        )}
                      </td>
                      <td className={''}>{ingredient.name}</td>
                      <td>{ingredient.shortName}</td>
                      <td>
                        <button
                          className={'btn btn-ghost btn-sm flex flex-row items-center gap-2'}
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
                        </button>
                      </td>
                      <td className={'whitespace-nowrap'}>{ingredient.price?.formatPrice() ?? '-'} €</td>
                      <td className={''}>
                        {ingredient.IngredientVolume.map((volume) => (
                          <div key={`ingredient-${ingredient.id}-volume-unit-${volume.id}`} className={'whitespace-nowrap'}>
                            {volume.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')} {userContext.getTranslation(volume.unit.name, 'de')}
                          </div>
                        ))}
                      </td>
                      <td>
                        {ingredient.IngredientVolume.map((volume) => (
                          <div key={`ingredient-${ingredient.id}-volume-unit-price-${volume.id}`} className={'whitespace-nowrap'}>
                            {((ingredient.price ?? 0) / volume.volume).formatPrice()} €/{userContext.getTranslation(volume.unit.name, 'de')}
                          </div>
                        ))}
                      </td>
                      <td>
                        {ingredient.tags.map((tag) => (
                          <div key={`ingredient-${ingredient.id}-tags-${tag}`} className={'badge badge-primary badge-outline m-1'}>
                            {tag}
                          </div>
                        ))}
                      </td>
                      <td>
                        {ingredient.link
                          ?.replace('https://', '')
                          .replace('http://', '')
                          .replace('www.', '')
                          .substring(0, ingredient.link?.replace('https://', '').replace('http://', '').replace('www.', '').indexOf('/')) ?? ''}
                      </td>
                      <td>
                        {ingredient.link == undefined ? (
                          <div className={'text-red-500'}>
                            <FaTimes />
                          </div>
                        ) : (
                          <div className={'text-success'}>
                            <FaCheck />
                          </div>
                        )}
                      </td>
                      <ManageColumn
                        entity={'ingredients'}
                        id={ingredient.id}
                        name={ingredient.name}
                        onRefresh={() => fetchIngredients(workspaceId, setIngredients, setLoading)}
                        onExportJson={handleExportSingleJson}
                        exportingJson={exportingSingleId === ingredient.id}
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

export default IngredientsOverviewPage;
