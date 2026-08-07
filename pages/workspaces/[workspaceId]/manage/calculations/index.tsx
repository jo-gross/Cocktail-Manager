import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { toIntlLocale } from '@lib/i18n/format';
import type { CalculationGroupDto, CalculationSummaryDto } from '@lib/schemas/calculations';
import {
  assignCalculationsToGroup,
  createCalculationGroup,
  deleteCalculation,
  deleteCalculationGroup,
  fetchCalculationsAndGroupsSafe,
  updateCalculationGroup,
} from '@lib/network/calculations';
import { alertApiV1Error } from '@lib/network/apiV1';
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

const CocktailCalculationOverviewPage: NextPageWithPullToRefresh = () => {
  const { t, i18n } = useTranslation(['manage', 'common', 'nav', 'settings', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;

  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [cocktailCalculations, setCocktailCalculations] = useState<CalculationSummaryDto[]>([]);
  const [calculationGroups, setCalculationGroups] = useState<CalculationGroupDto[]>([]);
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

  const getCalculationSortValue = useCallback((calc: CalculationSummaryDto, key: string) => {
    switch (key) {
      case 'name':
        return calc.name;
      case 'cocktails':
        return calc.items.length;
      case 'updatedAt':
        return new Date(calc.updatedAt);
      default:
        return null;
    }
  }, []);

  const formatUpdatedAt = useCallback(
    (dateString: string | Date) => {
      return new Date(dateString).toLocaleString(toIntlLocale(i18n.language), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [i18n.language],
  );

  const refreshCocktailCalculations = useCallback(() => {
    fetchCalculationsAndGroupsSafe(
      workspaceId,
      setCocktailCalculations,
      (groups) => {
        setCalculationGroups(groups);
        setCollapsedGroupIds(new Set(groups.filter((g) => !g.isDefaultExpanded).map((g) => g.id)));
      },
      setLoading,
    );
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
        items: sortedCalculations.filter((calc) => calc.group?.id === group.id),
      }))
      .filter((entry) => entry.items.length > 0);

    const ungrouped = sortedCalculations.filter((calc) => !calc.group?.id);
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
      try {
        await assignCalculationsToGroup(workspaceId, { calculationIds, groupId });
        alertService.success(groupId ? t('manage:calculations.groupAssigned') : t('manage:calculations.groupAssignmentRemoved'));
        setSelectedIds(new Set());
        refreshCocktailCalculations();
      } catch (error) {
        alertApiV1Error(error, t('errors:assignGroup'));
      }
    },
    [workspaceId, refreshCocktailCalculations, t],
  );

  const openAssignGroupModal = useCallback(
    (calculationIds: string[]) => {
      if (calculationGroups.length === 0) {
        alertService.error(t('manage:calculations.createGroupFirst'));
        return;
      }
      modalContext.openModal(
        <div className={'grid grid-cols-1 gap-3 p-2'}>
          <div className={'text-xl font-bold'}>{t('manage:calculations.assignGroup')}</div>
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
              {t('manage:calculations.selectGroup')}
            </option>
            {calculationGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.calculationCount})
              </option>
            ))}
          </Select>
          <div className={'text-xs opacity-70'}>{t('manage:calculations.assignGroupTip')}</div>
        </div>,
      );
    },
    [calculationGroups, modalContext, assignGroup, t],
  );

  const openCreateGroupModal = useCallback(() => {
    if (!workspaceId) return;
    modalContext.openModal(
      <div className={'grid grid-cols-1 gap-3 p-2'}>
        <div className={'text-xl font-bold'}>{t('manage:calculations.newGroup')}</div>
        <Input id={'new-calculation-group-name'} className="w-full" placeholder={t('manage:calculations.groupNamePlaceholder')} autoFocus />
        <Label className="cursor-pointer flex-row items-center justify-start gap-2">
          <Checkbox id={'new-calculation-group-expanded'} checkboxSize="sm" />
          <LabelText>{t('manage:calculations.defaultExpanded')}</LabelText>
        </Label>
        <Button
          type={'button'}
          variant="primary"
          onClick={async () => {
            const nameInput = document.getElementById('new-calculation-group-name') as HTMLInputElement | null;
            const expandedInput = document.getElementById('new-calculation-group-expanded') as HTMLInputElement | null;
            const name = nameInput?.value?.trim() ?? '';
            if (!name) {
              alertService.error(t('manage:calculations.enterGroupName'));
              return;
            }
            try {
              await createCalculationGroup(workspaceId, { name, isDefaultExpanded: expandedInput?.checked ?? false });
              modalContext.closeAllModals();
              alertService.success(t('manage:calculations.groupCreated'));
              refreshCocktailCalculations();
            } catch (error) {
              alertApiV1Error(error, t('errors:createGroup'));
            }
          }}
        >
          {t('common:create')}
        </Button>
      </div>,
    );
  }, [workspaceId, modalContext, refreshCocktailCalculations, t]);

  const handleToggleGroupDefaultExpanded = useCallback(
    async (group: CalculationGroupDto) => {
      if (!workspaceId) return;
      try {
        await updateCalculationGroup(workspaceId, group.id, { name: group.name, isDefaultExpanded: !group.isDefaultExpanded });
        refreshCocktailCalculations();
      } catch (error) {
        alertApiV1Error(error, t('errors:updateGroup'));
      }
    },
    [workspaceId, refreshCocktailCalculations, t],
  );

  const handleDeleteGroup = useCallback(
    (group: CalculationGroupDto) => {
      if (!workspaceId) return;
      modalContext.openModal(
        <ConfirmActionModal
          title={t('manage:calculations.deleteGroupTitle')}
          message={t('manage:calculations.deleteGroupConfirm', { name: group.name })}
          confirmLabel={t('common:delete')}
          confirmVariant={'error'}
          onConfirm={async () => {
            try {
              await deleteCalculationGroup(workspaceId, group.id);
              alertService.success(t('entity:groupDeleted'));
              refreshCocktailCalculations();
            } catch (error) {
              alertApiV1Error(error, t('errors:deleteGroup'));
            }
          }}
        />,
      );
    },
    [workspaceId, modalContext, refreshCocktailCalculations, t],
  );

  const handleExportJson = useCallback(async () => {
    if (!workspaceId || selectedIds.size === 0) return;
    setExportingJson(true);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/calculations/export/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: t('errors:export') }));
        alertService.error(error.message ?? t('errors:export'));
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
      alertService.success(t('entity:jsonExported'));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('JSON export error:', error);
      alertService.error(t('errors:export'));
    } finally {
      setExportingJson(false);
    }
  }, [workspaceId, selectedIds, t]);

  const handleExportSingleJson = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      setExportingSingleId(id);
      try {
        const response = await fetch(`/api/v1/workspaces/${workspaceId}/calculations/export/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: t('errors:export') }));
          alertService.error(error.message ?? t('errors:export'));
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
        alertService.success(t('entity:jsonExported'));
      } catch (error) {
        console.error('JSON export error:', error);
        alertService.error(t('errors:export'));
      } finally {
        setExportingSingleId(null);
      }
    },
    [workspaceId, cocktailCalculations, t],
  );

  const handleBulkDelete = useCallback(() => {
    if (!workspaceId || selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    modalContext.openModal(
      <ConfirmActionModal
        title={t('common:delete')}
        message={t('manage:calculations.deleteCalculationsConfirm', { count })}
        confirmLabel={t('common:delete')}
        confirmVariant="error"
        onConfirm={async () => {
          try {
            for (const id of ids) {
              await deleteCalculation(workspaceId, id);
            }
            setSelectedIds(new Set());
            refreshCocktailCalculations();
            alertService.success(t('manage:calculations.calculationsDeleted', { count }));
          } catch (error) {
            alertApiV1Error(error, t('errors:deleteFailed'));
          }
        }}
      />,
    );
  }, [workspaceId, selectedIds, modalContext, refreshCocktailCalculations, t]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={t('entity:plural.calculations')}
      actions={
        <div className={'flex items-center gap-2'}>
          {selectedIds.size > 0 && (
            <Dropdown align="end">
              <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" tabIndex={0}>
                <FaFileDownload />
                {t('manage:selectedCount', { count: selectedIds.size })}
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
                      {t('manage:exportAsJsonCount', { count: selectedIds.size })}
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => openAssignGroupModal(Array.from(selectedIds))}>
                      <FaLayerGroup />
                      {t('manage:calculations.assignGroupCount', { count: selectedIds.size })}
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => assignGroup(Array.from(selectedIds), null)}>
                      <FaLayerGroup />
                      {t('manage:calculations.removeGroupAssignmentCount', { count: selectedIds.size })}
                    </button>
                  </li>
                  {userContext.isUserPermitted(Role.ADMIN) && (
                    <li>
                      <button type="button" className="text-error" onClick={handleBulkDelete}>
                        <FaTrashAlt />
                        {t('manage:deleteCount', { count: selectedIds.size })}
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
              {t('manage:calculations.groups')}
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
                    {t('manage:calculations.createNewGroup')}
                  </button>
                </li>
                <li className="pointer-events-none px-3 py-1 text-xs font-semibold uppercase opacity-60">
                  <span>{t('manage:calculations.existingGroups')}</span>
                </li>
                {calculationGroups.length === 0 ? (
                  <li>
                    <span className={'opacity-70'}>{t('manage:calculations.noGroupsYet')}</span>
                  </li>
                ) : (
                  calculationGroups.map((group) => (
                    <li key={group.id}>
                      <div className={'flex items-center justify-between gap-2'}>
                        <span className={'truncate'}>
                          {group.name} ({group.calculationCount})
                        </span>
                        <div className={'flex items-center gap-1'}>
                          <Button type={'button'} variant="ghost" size="xs" onClick={() => handleToggleGroupDefaultExpanded(group)}>
                            {group.isDefaultExpanded ? t('manage:calculations.standardOn') : t('manage:calculations.standardOff')}
                          </Button>
                          <Tooltip tip={t('manage:calculations.deleteGroupTooltip', { name: group.name })}>
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
              {t('common:import')}
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
                    {t('manage:importFromJson')}
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
                      aria-label={t('common:selectAll')}
                    />
                  </TableHeaderCell>
                  <SortableHeaderCell sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    {t('common:name')}
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="cocktails" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    {t('nav:cocktails')}
                  </SortableHeaderCell>
                  <SortableHeaderCell sortKey="updatedAt" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    {t('manage:lastEdited')}
                  </SortableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={5} avatarColumn={-1} />
                ) : sortedCalculations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={'text-center'}>
                      {t('manage:noEntriesFound')}
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
                                {cocktailCalculation.items
                                  .map((calculationItem) => calculationItem.cocktail.name)
                                  .sort((a, b) => a.localeCompare(b))
                                  .join(', ')}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
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
                                    label: t('manage:calculations.assignGroup'),
                                    icon: <FaLayerGroup />,
                                    onClick: (id) => openAssignGroupModal([id]),
                                  },
                                  {
                                    label: t('manage:calculations.removeGroupAssignment'),
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
                            <div className={'px-2 py-1 font-semibold'}>
                              {t('manage:calculations.ungrouped', { count: groupedCalculations.ungrouped.length })}
                            </div>
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
                              {cocktailCalculation.items
                                .map((calculationItem) => calculationItem.cocktail.name)
                                .sort((a, b) => a.localeCompare(b))
                                .join(', ')}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs opacity-70">{formatUpdatedAt(cocktailCalculation.updatedAt)}</span>
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
                                  label: t('manage:calculations.assignGroup'),
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
