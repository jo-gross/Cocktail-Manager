import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { Role } from '@generated/prisma/client';
import type { ActionDto } from '@lib/schemas/actions';
import type { UnitDto, UnitConversionDto } from '@lib/schemas/units';
import type { IceDto } from '@lib/schemas/ices';
import { UserContext } from '@lib/context/UserContextProvider';
import { FaArrowDown, FaArrowUp, FaTrashAlt } from 'react-icons/fa';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { formatDate } from '@lib/DateUtils';
import { Loading } from '@components/Loading';
import _ from 'lodash';
import CocktailStepActionModal from '../../../../../components/modals/CocktailStepActionModal';
import EditTranslationModal from '../../../../../components/modals/EditTranslationModal';
import UnitModal from '../../../../../components/modals/UnitModal';
import UnitConversionModal from '../../../../../components/modals/UnitConversionModal';
import { fetchUnitConversions, fetchUnits, deleteUnit as deleteUnitRequest, deleteUnitConversion as deleteUnitConversionRequest } from '@lib/network/units';
import { fetchActions, deleteAction } from '@lib/network/actions';
import { alertApiV1Error, apiV1FetchSafe, apiV1Mutate } from '@lib/network/apiV1';
import type { WorkspaceSettingsDto } from '@lib/schemas/workspace';
import { deleteWorkspace, updateWorkspace } from '@lib/network/workspaces';
import { fetchIce, deleteIce as deleteIceRequest } from '@lib/network/ices';
import CreateIceModal from '../../../../../components/modals/CreateIceModal';
import { EntityTranslationCells, EntityTranslationHeaderCells, ENTITY_TRANSLATION_COLUMN_COUNT } from '@components/settings/EntityTranslationLabels';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardTitle,
  Divider,
  FileInput,
  FormControl,
  Input,
  Label,
  LabelText,
  LabelTextAlt,
  Loading as UiLoading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@components/ui';

function WorkspaceSettingPage() {
  const { t } = useTranslation(['settings', 'common', 'errors', 'entity']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const { workspaceId } = router.query;

  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');

  const [exporting, setExporting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

  const [uploadImportFile, setUploadImportFile] = useState<File>();
  const uploadImportFileRef = useRef<HTMLInputElement>(null);

  const [workspaceDeleting, setWorkspaceDeleting] = useState<boolean>(false);
  const [workspaceRenaming, setWorkspaceRenaming] = useState<boolean>(false);

  const [workspaceActions, setWorkspaceActions] = useState<ActionDto[]>([]);
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<boolean>(false);

  const [units, setUnits] = useState<UnitDto[]>([]);
  const [unitsLoading, setUnitsLoading] = useState<boolean>(false);

  const [unitConversions, setUnitConversions] = useState<UnitConversionDto[]>([]);
  const [unitConversionsLoading, setUnitConversionsLoading] = useState<boolean>(false);

  const [iceOptions, setIceOptions] = useState<IceDto[]>([]);
  const [iceOptionsLoading, setIceOptionsLoading] = useState<boolean>(false);

  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});

  const [collapsedGeneratedUnits, setCollapsedGeneratedUnits] = useState<boolean>(false);

  // Statistik-Einstellungen
  const [statisticDayStartTime, setStatisticDayStartTime] = useState<string>('00:00');
  const [statisticSettingsSaving, setStatisticSettingsSaving] = useState<boolean>(false);

  // Lade Workspace-Settings beim Start
  useEffect(() => {
    if (!workspaceId) return;
    apiV1FetchSafe<WorkspaceSettingsDto>(`/api/v1/workspaces/${workspaceId}/settings`)
      .then((settings) => {
        if (settings?.statisticDayStartTime) {
          setStatisticDayStartTime(settings.statisticDayStartTime);
        }
      })
      .catch(console.error);
  }, [workspaceId]);

  const saveStatisticDayStartTime = useCallback(async () => {
    if (!workspaceId) return;
    setStatisticSettingsSaving(true);
    try {
      await apiV1Mutate<WorkspaceSettingsDto>(`/api/v1/workspaces/${workspaceId}/settings`, 'PUT', {
        setting: 'statisticDayStartTime',
        value: statisticDayStartTime,
      });
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      console.error('saveStatisticDayStartTime', error);
      alertService.error(t('errors:save'));
    } finally {
      setStatisticSettingsSaving(false);
    }
  }, [workspaceId, statisticDayStartTime, t]);

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch(`/api/v1/workspaces/${workspaceId}/admin/backups/export`)
      .then((response) => response.text())
      .then((content) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `The Cocktail-Manager ${userContext.workspace?.name} Backup ${formatDate(new Date())}.json`;
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
      })
      .catch((error) => {
        console.error('Settings-Page -> exportAll', error);
        alertService.error(t('errors:export'));
      })
      .finally(() => setExporting(false));
  }, [userContext.workspace?.name, workspaceId, t]);

  const importBackup = useCallback(async () => {
    try {
      if (uploadImportFile == undefined) return;
      if (importing) return;

      setImporting(true);

      const data: BackupStructure = JSON.parse(await uploadImportFile.text());

      const response = await fetch(`/api/v1/workspaces/${workspaceId}/admin/backups/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('SettingsPage -> importBackup -> response', response);
      if (response.ok) {
        fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
        alertService.success(t('entity:importSuccess'));
        router.reload();
        setUploadImportFile(undefined);
        if (uploadImportFileRef.current) {
          uploadImportFileRef.current.value = '';
        }
      } else {
        const body = await response.json();
        console.error('Admin -> ImportBackup', response);
        alertService.error(body.error?.message ?? body.message ?? t('errors:import'), response.status, response.statusText);
      }
    } catch (error) {
      console.error('SettingsPage -> importBackup', error);
      alertService.error(t('errors:import'));
    } finally {
      setImporting(false);
    }
  }, [importing, uploadImportFile, workspaceId, t, router]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    if (!confirm(t('settings:deleteWorkspaceConfirm'))) return;
    setWorkspaceDeleting(true);
    try {
      await deleteWorkspace(workspaceId);
      await router.replace('/');
      alertService.success(t('common:success.deleted'));
    } catch (error) {
      alertApiV1Error(error, t('errors:deleteWorkspace'));
    } finally {
      setWorkspaceDeleting(false);
    }
  }, [router, workspaceId, t]);

  const handleRenameWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    setWorkspaceRenaming(true);
    try {
      await updateWorkspace(workspaceId, { name: newWorkspaceName });
      router.reload();
      alertService.success(t('entity:renameSuccess'));
    } catch (error) {
      alertApiV1Error(error, t('errors:renameWorkspace'));
    } finally {
      setWorkspaceRenaming(false);
    }
  }, [newWorkspaceName, router, workspaceId, t]);

  const deleteCocktailRecipeAction = useCallback(
    async (actionId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[actionId] ?? false) return;
      setDeleting({ ...deleting, [actionId]: true });
      try {
        await deleteAction(workspaceId, actionId);
        fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
        alertService.success(t('common:success.deleted'));
      } catch (error) {
        alertApiV1Error(error, t('errors:delete'));
      } finally {
        setDeleting({ ...deleting, [actionId]: false });
      }
    },
    [deleting, workspaceId, t],
  );

  const deleteUnit = useCallback(
    async (unitId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[unitId] ?? false) return;
      setDeleting({ ...deleting, [unitId]: true });
      try {
        await deleteUnitRequest(workspaceId, unitId);
        fetchUnits(workspaceId, setUnits, setUnitsLoading);
        fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
        alertService.success(t('common:success.deleted'));
      } catch (error) {
        alertApiV1Error(error, t('errors:delete'));
      } finally {
        setDeleting({ ...deleting, [unitId]: false });
      }
    },
    [deleting, workspaceId, t],
  );

  const deleteUnitConversion = useCallback(
    async (unitConversionId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[unitConversionId] ?? false) return;
      setDeleting({ ...deleting, [unitConversionId]: true });
      try {
        await deleteUnitConversionRequest(workspaceId, unitConversionId);
        fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
        alertService.success(t('common:success.deleted'));
      } catch (error) {
        alertApiV1Error(error, t('errors:delete'));
      } finally {
        setDeleting({ ...deleting, [unitConversionId]: false });
      }
    },
    [deleting, workspaceId, t],
  );

  const deleteIce = useCallback(
    async (iceId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[iceId] ?? false) return;
      setDeleting({ ...deleting, [iceId]: true });
      try {
        await deleteIceRequest(workspaceId, iceId);
        fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
        alertService.success(t('common:success.deleted'));
      } catch (error) {
        alertApiV1Error(error, t('errors:delete'));
      } finally {
        setDeleting({ ...deleting, [iceId]: false });
      }
    },
    [deleting, workspaceId, t],
  );

  useEffect(() => {
    fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
    fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
    fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
  }, [workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={t('settings:title', { name: userContext.workspace?.name })}>
      <div className={'grid grid-flow-row-dense grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
        {/*Cocktail Recipe Actions*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <Card className="h-min">
            <CardBody>
              <CardTitle>{t('settings:preparation')}</CardTitle>
              <div>{t('settings:preparationHelp')}</div>
              {workspaceActionLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'text-lg font-bold'}>{t('settings:methods')}</div>
                  <div className={'overflow-x-auto'}>
                    <Table zebra className="grid-col-full w-full table-auto">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t('settings:key')}</TableHeaderCell>
                          <EntityTranslationHeaderCells />
                          <TableHeaderCell>{t('settings:groupIdentifier')}</TableHeaderCell>
                          <TableHeaderCell className="flex flex-row justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                modalContext.openModal(
                                  <CocktailStepActionModal
                                    cocktailStepAction={undefined}
                                    cocktailStepActionGroups={Object.keys(_.groupBy(workspaceActions, 'actionGroup'))}
                                    onSaved={() => fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading)}
                                  />,
                                );
                              }}
                            >
                              {t('common:add')}
                            </Button>
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workspaceActions.length == 0 ? (
                          <TableRow>
                            <TableCell colSpan={3 + ENTITY_TRANSLATION_COLUMN_COUNT}>{t('common:emptyEntriesPresent')}</TableCell>
                          </TableRow>
                        ) : (
                          workspaceActions.map((action) => (
                            <TableRow key={`action-${action.id}`}>
                              <TableCell>{action.name}</TableCell>
                              <EntityTranslationCells translationKey={action.name} />
                              <TableCell>{userContext.getTranslation(action.actionGroup)}</TableCell>
                              <TableCell className="flex flex-row justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    modalContext.openModal(
                                      <CocktailStepActionModal
                                        cocktailStepAction={action}
                                        cocktailStepActionGroups={Object.keys(_.groupBy(workspaceActions, 'actionGroup'))}
                                        onSaved={() => fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading)}
                                      />,
                                    );
                                  }}
                                >
                                  {t('common:edit')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-error text-error hover:bg-error/10"
                                  disabled={deleting[action.id] ?? false}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(action.name)}
                                        onApprove={() => deleteCocktailRecipeAction(action.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[action.id] ?? false) ? <UiLoading size="sm" /> : null}
                                  <FaTrashAlt />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className={'text-lg font-bold'}>{t('settings:groups')}</div>
                  <div>{t('settings:groupsHelp')}</div>

                  <div className={'overflow-x-auto'}>
                    <Table zebra className="grid-col-full w-full table-auto">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t('settings:key')}</TableHeaderCell>
                          <EntityTranslationHeaderCells />
                          <TableHeaderCell></TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(_.groupBy(workspaceActions, 'actionGroup')).length == 0 ? (
                          <TableRow>
                            <TableCell colSpan={2 + ENTITY_TRANSLATION_COLUMN_COUNT}>{t('common:emptyEntriesPresent')}</TableCell>
                          </TableRow>
                        ) : (
                          Object.entries(_.groupBy(workspaceActions, 'actionGroup')).map(([group, _groupActions]) => (
                            <TableRow key={`action-group-${group}`}>
                              <TableCell>{group}</TableCell>
                              <EntityTranslationCells translationKey={group} />
                              <TableCell className="flex flex-row justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    modalContext.openModal(<EditTranslationModal identifier={group} slang={t('settings:slang.actionGroup')} />);
                                  }}
                                >
                                  {t('common:edit')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        ) : (
          <></>
        )}
        {/*Workspace Units*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <Card className={`${!collapsedGeneratedUnits ? 'row-span-2' : 'row-span-6'} h-fit`}>
            <CardBody>
              <CardTitle>{t('settings:units')}</CardTitle>
              <div>{t('settings:unitsHelp')}</div>
              {unitsLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'text-lg font-bold'}>{t('settings:units')}</div>
                  <div className={'overflow-x-auto'}>
                    <Table zebra className="grid-col-full w-full table-auto">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t('settings:key')}</TableHeaderCell>
                          <EntityTranslationHeaderCells />
                          <TableHeaderCell className="flex flex-row justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                modalContext.openModal(<UnitModal unit={undefined} onSaved={() => fetchUnits(workspaceId, setUnits, setUnitsLoading)} />);
                              }}
                            >
                              {t('common:add')}
                            </Button>
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {units.length == 0 ? (
                          <TableRow>
                            <TableCell colSpan={2 + ENTITY_TRANSLATION_COLUMN_COUNT} className="text-center">
                              {t('common:emptyEntriesPresent')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          units.map((unit) => (
                            <TableRow key={`unit-${unit.id}`}>
                              <TableCell>{unit.name}</TableCell>
                              <EntityTranslationCells translationKey={unit.name} />
                              <TableCell className="flex flex-row justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    modalContext.openModal(<UnitModal unit={unit} onSaved={() => fetchUnits(workspaceId, setUnits, setUnitsLoading)} />);
                                  }}
                                >
                                  {t('common:edit')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-error text-error hover:bg-error/10"
                                  disabled={deleting[unit.id] ?? false}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(unit.name)}
                                        onApprove={() => deleteUnit(unit.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[unit.id] ?? false) ? <UiLoading size="sm" /> : null}
                                  <FaTrashAlt />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className={'text-lg font-bold'}>{t('settings:conversions')}</div>
                  <div>{t('settings:conversionsHelp')}</div>
                  <div className={'overflow-x-auto'}>
                    <Table zebra className="grid-col-full w-full">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t('settings:unitA')}</TableHeaderCell>
                          <TableHeaderCell className="text-right">{t('settings:unitFactor')}</TableHeaderCell>
                          <TableHeaderCell>{t('settings:unitB')}</TableHeaderCell>
                          <TableHeaderCell></TableHeaderCell>
                          <TableHeaderCell className="flex justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                modalContext.openModal(
                                  <UnitConversionModal
                                    units={units}
                                    existingConversions={unitConversions}
                                    onSaved={() => fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions)}
                                  />,
                                );
                              }}
                            >
                              {t('common:add')}
                            </Button>
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unitConversionsLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              <Loading />
                            </TableCell>
                          </TableRow>
                        ) : unitConversions.length == 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              {t('common:emptyEntriesPresent')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {unitConversions
                              .filter((conversion) => !conversion.autoGenerated)
                              .map((conversion) => (
                                <TableRow key={`unit-conversion-${conversion.id}`}>
                                  <TableCell>{userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '')}</TableCell>
                                  <TableCell className="text-right">
                                    {conversion.factor.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell>{userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '')}</TableCell>
                                  <TableCell>
                                    {t('settings:conversionEquals', {
                                      to: userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? ''),
                                      factor: (1 / conversion.factor).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }),
                                      from: userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? ''),
                                    })}
                                  </TableCell>
                                  <TableCell className="flex flex-row justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-primary text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        modalContext.openModal(
                                          <UnitConversionModal
                                            units={units}
                                            existingConversions={[conversion]}
                                            onSaved={() => fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions)}
                                            unitConversion={conversion}
                                          />,
                                        );
                                      }}
                                    >
                                      {t('common:edit')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-error text-error hover:bg-error/10"
                                      disabled={deleting[conversion.id] ?? false}
                                      onClick={() =>
                                        modalContext.openModal(
                                          <DeleteConfirmationModal
                                            spelling={'DELETE'}
                                            entityName={t('settings:conversionTo', {
                                              from: userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A'),
                                              to: userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A'),
                                            })}
                                            onApprove={() => deleteUnitConversion(conversion.id)}
                                          />,
                                        )
                                      }
                                    >
                                      {(deleting[conversion.id] ?? false) ? <UiLoading size="sm" /> : null}
                                      <FaTrashAlt />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            <TableRow onClick={() => setCollapsedGeneratedUnits(!collapsedGeneratedUnits)}>
                              <TableCell colSpan={4} className="cursor-pointer italic">
                                {t('settings:autoGeneratedConversions')}{' '}
                                <span className="underline">{!collapsedGeneratedUnits ? t('common:show') : t('common:hide')}</span>
                              </TableCell>
                              <TableCell className="flex items-center justify-end">
                                <div className="p-2">{collapsedGeneratedUnits ? <FaArrowUp /> : <FaArrowDown />}</div>
                              </TableCell>
                            </TableRow>

                            {collapsedGeneratedUnits ? (
                              unitConversions
                                .filter((conversion) => conversion.autoGenerated)
                                .sort((a, b) => a.fromUnitId.localeCompare(b.fromUnitId) || a.toUnitId.localeCompare(b.toUnitId))
                                .map((conversion) => (
                                  <TableRow key={`unit-conversion-${conversion.id}`}>
                                    <TableCell>{userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A')}</TableCell>
                                    <TableCell className="text-right">
                                      {conversion.factor.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </TableCell>
                                    <TableCell>{userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A')}</TableCell>
                                    <TableCell>
                                      {t('settings:conversionEquals', {
                                        to: userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A'),
                                        factor: (1 / conversion.factor).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }),
                                        from: userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A'),
                                      })}
                                    </TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                ))
                            ) : (
                              <></>
                            )}
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        ) : (
          <></>
        )}

        {/*Ice*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <Card className="h-min">
            <CardBody>
              <CardTitle>{t('settings:ice')}</CardTitle>
              <div>{t('settings:iceHelp')}</div>
              {iceOptionsLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'overflow-x-auto'}>
                    <Table zebra className="grid-col-full w-full table-auto">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t('settings:key')}</TableHeaderCell>
                          <EntityTranslationHeaderCells />
                          <TableHeaderCell className="flex flex-row justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                modalContext.openModal(<CreateIceModal onSaved={() => fetchIce(workspaceId, setIceOptions, setIceOptionsLoading)} />);
                              }}
                            >
                              {t('common:add')}
                            </Button>
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {iceOptions.length == 0 ? (
                          <TableRow>
                            <TableCell colSpan={2 + ENTITY_TRANSLATION_COLUMN_COUNT}>{t('common:emptyEntriesPresent')}</TableCell>
                          </TableRow>
                        ) : (
                          iceOptions.map((iceOption, indexIceOption) => (
                            <TableRow key={`ice-option-${indexIceOption}`}>
                              <TableCell>{iceOption.name}</TableCell>
                              <EntityTranslationCells translationKey={iceOption.name} />
                              <TableCell className="flex flex-row justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    modalContext.openModal(<EditTranslationModal identifier={iceOption.name} slang={t('settings:slang.ice')} />);
                                  }}
                                >
                                  {t('common:edit')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-error text-error hover:bg-error/10"
                                  disabled={deleting[iceOption.id] ?? false}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(iceOption.name)}
                                        onApprove={() => deleteIce(iceOption.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[iceOption.id] ?? false) ? <UiLoading size="sm" /> : null}
                                  <FaTrashAlt />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        ) : (
          <></>
        )}

        {/* Statistik-Einstellungen */}
        {userContext.isUserPermitted(Role.MANAGER) ? (
          <>
            <div className={'col-span-full'}></div>
            <Card>
              <CardBody>
                <CardTitle>{t('settings:statistics')}</CardTitle>
                <FormControl>
                  <Label>
                    <LabelText className="font-semibold">{t('settings:dayStartTime')}</LabelText>
                  </Label>
                  <p className="mb-2 text-sm text-base-content/70">{t('settings:dayStartHelp')}</p>
                  <ButtonGroup className="w-full">
                    <Input type="time" joinItem className="w-full" value={statisticDayStartTime} onChange={(e) => setStatisticDayStartTime(e.target.value)} />
                    <Button type="button" variant="primary" joinItem onClick={saveStatisticDayStartTime} disabled={statisticSettingsSaving}>
                      {statisticSettingsSaving ? <UiLoading size="sm" /> : null}
                      {t('common:save')}
                    </Button>
                  </ButtonGroup>
                  <Label>
                    <LabelTextAlt>{t('settings:dayStartCurrent', { time: statisticDayStartTime })}</LabelTextAlt>
                  </Label>
                </FormControl>
              </CardBody>
            </Card>
          </>
        ) : null}

        {userContext.isUserPermitted(Role.ADMIN) ? (
          <>
            <div className={'col-span-full'}></div>
            <Card>
              <CardBody>
                <CardTitle>{t('settings:dataTransfer')}</CardTitle>
                <FormControl>
                  <FileInput disabled={importing} ref={uploadImportFileRef} onChange={(event) => setUploadImportFile(event.target.files?.[0])} />
                </FormControl>
                <Button type="button" variant="primary" disabled={uploadImportFile == undefined || importing} onClick={importBackup}>
                  {importing ? <UiLoading size="sm" /> : null}
                  {t('settings:import')}
                </Button>
                <Button type="button" variant="primary" onClick={exportAll} disabled={exporting}>
                  {exporting ? <UiLoading size="sm" /> : null}
                  {t('settings:exportAll')}
                </Button>
              </CardBody>
            </Card>
          </>
        ) : (
          <></>
        )}

        {/*Workspace Dangerous Actions*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'col-span-full'}>
            <Divider>{t('settings:dangerZone')}</Divider>
            <Card>
              <CardBody>
                <CardTitle>{t('settings:dangerZone')}</CardTitle>
                <Label className="cursor-pointer">
                  <LabelText>{t('settings:renameWorkspace')}</LabelText>
                </Label>
                <ButtonGroup className="w-full">
                  <Input type="text" joinItem className="w-full" value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} />
                  <Button
                    type="button"
                    variant="outline"
                    joinItem
                    className="border-error text-error hover:bg-error/10"
                    disabled={newWorkspaceName.length < 3 || newWorkspaceName.length > 50}
                    onClick={handleRenameWorkspace}
                  >
                    {workspaceRenaming ? <UiLoading size="sm" /> : null}
                    {t('settings:rename')}
                  </Button>
                </ButtonGroup>
                <Divider />
                <Button
                  type="button"
                  variant="outline"
                  className="border-error text-error hover:bg-error/10"
                  onClick={() =>
                    modalContext.openModal(
                      <DeleteConfirmationModal onApprove={handleDeleteWorkspace} entityName={t('settings:thisWorkspace')} spelling={'DELETE'} />,
                    )
                  }
                >
                  {workspaceDeleting ? <UiLoading size="sm" /> : null}
                  {t('settings:deleteWorkspace')}
                </Button>
              </CardBody>
            </Card>
          </div>
        ) : (
          <></>
        )}
      </div>
    </ManageEntityLayout>
  );
}

export default withPagePermission(['ADMIN'], WorkspaceSettingPage, '/workspaces/[workspaceId]/manage');
