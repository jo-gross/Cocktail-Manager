import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { Ice, Role, Unit, UnitConversion, WorkspaceCocktailRecipeStepAction } from '@generated/prisma/client';
import { UserContext } from '@lib/context/UserContextProvider';
import { FaArrowDown, FaArrowUp, FaTrashAlt } from 'react-icons/fa';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import '../../../../../lib/DateUtils';
import { Loading } from '@components/Loading';
import _ from 'lodash';
import CocktailStepActionModal from '../../../../../components/modals/CocktailStepActionModal';
import EditTranslationModal from '../../../../../components/modals/EditTranslationModal';
import UnitModal from '../../../../../components/modals/UnitModal';
import UnitConversionModal from '../../../../../components/modals/UnitConversionModal';
import { fetchUnitConversions, fetchUnits } from '@lib/network/units';
import { fetchActions } from '@lib/network/actions';

import { fetchIce } from '@lib/network/ices';
import CreateIceModal from '../../../../../components/modals/CreateIceModal';
import { withPagePermission } from '@middleware/ui/withPagePermission';

function WorkspaceSettingPage() {
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

  const [workspaceActions, setWorkspaceActions] = useState<WorkspaceCocktailRecipeStepAction[]>([]);
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<boolean>(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState<boolean>(false);

  const [unitConversions, setUnitConversions] = useState<UnitConversion[]>([]);
  const [unitConversionsLoading, setUnitConversionsLoading] = useState<boolean>(false);

  const [iceOptions, setIceOptions] = useState<Ice[]>([]);
  const [iceOptionsLoading, setIceOptionsLoading] = useState<boolean>(false);

  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});

  const [collapsedGeneratedUnits, setCollapsedGeneratedUnits] = useState<boolean>(false);

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch(`/api/workspaces/${workspaceId}/admin/backups/export`)
      .then((response) => response.text())
      .then((content) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `The Cocktail-Manager ${userContext.workspace?.name} Backup ${new Date().toFormatDateString()}.json`;
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
      })
      .catch((error) => {
        console.error('Settings-Page -> exportAll', error);
        alertService.error('Fehler beim Exportieren');
      })
      .finally(() => setExporting(false));
  }, [userContext.workspace?.name, workspaceId]);

  const importBackup = useCallback(async () => {
    try {
      if (uploadImportFile == undefined) return;
      if (importing) return;

      setImporting(true);

      const data: BackupStructure = JSON.parse(await uploadImportFile.text());

      const response = await fetch(`/api/workspaces/${workspaceId}/admin/backups/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('SettingsPage -> importBackup -> response', response);
      if (response.ok) {
        fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
        alertService.success(`Import erfolgreich`);
        router.reload();
        setUploadImportFile(undefined);
        if (uploadImportFileRef.current) {
          uploadImportFileRef.current.value = '';
        }
      } else {
        const body = await response.json();
        console.error('Admin -> ImportBackup', response);
        alertService.error(body.message ?? 'Fehler beim Importieren', response.status, response.statusText);
      }
    } catch (error) {
      console.error('SettingsPage -> importBackup', error);
      alertService.error(`Fehler beim Importieren`);
    } finally {
      setImporting(false);
    }
  }, [importing, uploadImportFile, workspaceId]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!confirm('Workspace inkl. aller Zutaten und Rezepte wirklich löschen?')) return;
    setWorkspaceDeleting(true);
    fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          router.replace('/').then(() => alertService.success('Erfolgreich gelöscht'));
        } else {
          console.error('SettingsPage -> DeleteWorkspace', response);
          alertService.error(body.message ?? 'Fehler beim Löschen der Workspace', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('SettingsPage -> handleDeleteWorkspace', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      })
      .finally(() => {
        setWorkspaceDeleting(false);
      });
  }, [router, workspaceId]);

  const handleRenameWorkspace = useCallback(async () => {
    setWorkspaceRenaming(true);
    fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newWorkspaceName }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          router.reload();
          alertService.success(`Umbenennen erfolgreich`);
        } else {
          console.error('Admin -> RenameWorkspace', response);
          alertService.error(body.message ?? 'Fehler beim Umbenennen der Workspace', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('SettingsPage -> handleRenameWorkspace', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      })
      .finally(() => {
        setWorkspaceRenaming(false);
      });
  }, [newWorkspaceName, router, workspaceId]);

  const deleteCocktailRecipeAction = useCallback(
    async (actionId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[actionId] ?? false) return;
      setDeleting({ ...deleting, [actionId]: true });
      fetch(`/api/workspaces/${workspaceId}/actions/${actionId}`, {
        method: 'DELETE',
      })
        .then(async (response) => {
          if (response.ok) {
            fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
            alertService.success('Erfolgreich gelöscht');
          } else {
            const body = await response.json();
            console.error('SettingsPage -> deleteCocktailRecipeAction', response);
            alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
          }
        })
        .catch((error) => {
          console.error('SettingsPage -> deleteCocktailRecipeAction', error);
          alertService.error('Fehler beim Löschen');
        })
        .finally(() => {
          setDeleting({ ...deleting, [actionId]: false });
        });
    },
    [deleting, workspaceId],
  );

  const deleteUnit = useCallback(
    async (unitId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[unitId] ?? false) return;
      setDeleting({ ...deleting, [unitId]: true });
      fetch(`/api/workspaces/${workspaceId}/units/${unitId}`, {
        method: 'DELETE',
      })
        .then(async (response) => {
          if (response.ok) {
            fetchUnits(workspaceId, setUnits, setUnitsLoading);
            fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
            alertService.success('Erfolgreich gelöscht');
          } else {
            const body = await response.json();
            console.error('SettingsPage -> deleteUnit', response);
            alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
          }
        })
        .catch((error) => {
          console.error('SettingsPage -> deleteUnit', error);
          alertService.error('Fehler beim Löschen');
        })
        .finally(() => {
          setDeleting({ ...deleting, [unitId]: false });
        });
    },
    [deleting, workspaceId],
  );

  const deleteUnitConversion = useCallback(
    async (unitConversionId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[unitConversionId] ?? false) return;
      setDeleting({ ...deleting, [unitConversionId]: true });
      fetch(`/api/workspaces/${workspaceId}/units/conversions/${unitConversionId}`, {
        method: 'DELETE',
      })
        .then(async (response) => {
          if (response.ok) {
            fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
            alertService.success('Erfolgreich gelöscht');
          } else {
            const body = await response.json();
            console.error('SettingsPage -> deleteUnitConversion', response);
            alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
          }
        })
        .catch((error) => {
          console.error('SettingsPage -> deleteUnitConversion', error);
          alertService.error('Fehler beim Löschen');
        })
        .finally(() => {
          setDeleting({ ...deleting, [unitConversionId]: false });
        });
    },
    [deleting, workspaceId],
  );

  const deleteIce = useCallback(
    async (iceId: string) => {
      if (workspaceId == undefined) return;
      if (deleting[iceId] ?? false) return;
      setDeleting({ ...deleting, [iceId]: true });
      fetch(`/api/workspaces/${workspaceId}/ice/${iceId}`, {
        method: 'DELETE',
      })
        .then(async (response) => {
          if (response.ok) {
            fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
            alertService.success('Erfolgreich gelöscht');
          } else {
            const body = await response.json();
            console.error('SettingsPage -> deleteIce', response);
            alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
          }
        })
        .catch((error) => {
          console.error('SettingsPage -> deleteIce', error);
          alertService.error('Fehler beim Löschen');
        })
        .finally(() => {
          setDeleting({ ...deleting, [iceId]: false });
        });
    },
    [deleting, workspaceId],
  );

  useEffect(() => {
    fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
    fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
    fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
  }, [workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Workspace-Einstellungen'}>
      <div className={'grid grid-flow-row-dense grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
        {/*Cocktail Recipe Actions*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'card h-min'}>
            <div className={'card-body'}>
              <div className={'card-title'}>Zubereitung</div>
              <div>
                Bei der Zubereitung von Cocktails können unterschiedliche Aktionen durchgeführt werden. Hier lassen sich diese Anpassen und erstellen. Beachte,
                dass das Löschen erst dann funktioniert, wenn eine Aktion nicht mehr verwendet wird.
              </div>
              {workspaceActionLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'text-lg font-bold'}>Methoden</div>
                  <div className={'overflow-x-auto'}>
                    <table className={'grid-col-full table-zebra table w-full table-auto'}>
                      <thead>
                        <tr>
                          <td>Key</td>
                          <td>Deutsch</td>
                          <td>Gruppenbezeichner</td>
                          <td className={'flex flex-row justify-end'}>
                            <button
                              className={'btn btn-primary btn-sm'}
                              onClick={() => {
                                modalContext.openModal(
                                  <CocktailStepActionModal
                                    cocktailStepAction={undefined}
                                    cocktailStepActionGroups={Object.keys(_.groupBy(workspaceActions, 'actionGroup'))}
                                  />,
                                );
                              }}
                            >
                              Hinzufügen
                            </button>
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {workspaceActions.length == 0 ? (
                          <tr>
                            <td colSpan={4}>Keine Einträge vorhanden</td>
                          </tr>
                        ) : (
                          workspaceActions.map((action) => (
                            <tr key={`action-${action.id}`}>
                              <td>{action.name}</td>
                              <td>{userContext.getTranslation(action.name, 'de')}</td>
                              <td>{userContext.getTranslation(action.actionGroup, 'de')}</td>
                              <td className={'flex flex-row justify-end gap-2'}>
                                <button
                                  className={'btn btn-outline btn-primary btn-sm'}
                                  onClick={() => {
                                    modalContext.openModal(
                                      <CocktailStepActionModal
                                        cocktailStepAction={action}
                                        cocktailStepActionGroups={Object.keys(_.groupBy(workspaceActions, 'actionGroup'))}
                                      />,
                                    );
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={deleting[action.id] ?? false}
                                  className={'btn-red btn btn-outline btn-sm'}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(action.name, 'de')}
                                        onApprove={() => deleteCocktailRecipeAction(action.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[action.id] ?? false) ? <span className={'loading loading-spinner'} /> : <></>}
                                  <FaTrashAlt />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className={'text-lg font-bold'}>Gruppen</div>
                  <div>Diese können bei den Methoden erstellt werden, hier kannst du die passende Anzeige einstellen</div>

                  <div className={'overflow-x-auto'}>
                    <table className={'grid-col-full table-zebra table w-full table-auto'}>
                      <thead>
                        <tr>
                          <td>Key</td>
                          <td>Deutsch</td>
                          <td></td>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(_.groupBy(workspaceActions, 'actionGroup')).length == 0 ? (
                          <tr>
                            <td colSpan={3}>Keine Einträge vorhanden</td>
                          </tr>
                        ) : (
                          Object.entries(_.groupBy(workspaceActions, 'actionGroup')).map(([group, groupActions]) => (
                            <tr key={`action-group-${group}`}>
                              <td>{group}</td>
                              <td>{userContext.getTranslation(group, 'de')}</td>
                              <td className={'flex flex-row justify-end gap-2'}>
                                <button
                                  className={'btn btn-outline btn-primary btn-sm'}
                                  onClick={() => {
                                    modalContext.openModal(<EditTranslationModal identifier={group} slang={'Zubereitungsgruppe'} />);
                                  }}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <></>
        )}
        {/*Workspace Units*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={`${!collapsedGeneratedUnits ? 'row-span-2' : 'row-span-6'} card h-fit`}>
            <div className={'card-body'}>
              <div className={'card-title'}>Einheiten</div>
              <div>Hier lassen sich alle Einheiten, die bei der Zubereitung eines Cocktails ausgewählt werden können angepasst werden.</div>
              {unitsLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'text-lg font-bold'}>Einheiten</div>
                  <div className={'overflow-x-auto'}>
                    <table className={'grid-col-full table-zebra table w-full table-auto'}>
                      <thead>
                        <tr>
                          <td>Key</td>
                          <td>Deutsch</td>
                          <td className={'flex flex-row justify-end'}>
                            <button
                              className={'btn btn-primary btn-sm'}
                              onClick={() => {
                                modalContext.openModal(<UnitModal unit={undefined} onSaved={() => fetchUnits(workspaceId, setUnits, setUnitsLoading)} />);
                              }}
                            >
                              Hinzufügen
                            </button>
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {units.length == 0 ? (
                          <tr>
                            <td colSpan={3} className={'text-center'}>
                              Keine Einträge vorhanden
                            </td>
                          </tr>
                        ) : (
                          units.map((unit) => (
                            <tr key={`unit-${unit.id}`}>
                              <td>{unit.name}</td>
                              <td>{userContext.getTranslation(unit.name, 'de')}</td>
                              <td className={'flex flex-row justify-end gap-2'}>
                                <button
                                  className={'btn btn-outline btn-primary btn-sm'}
                                  onClick={() => {
                                    modalContext.openModal(<UnitModal unit={unit} />);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={deleting[unit.id] ?? false}
                                  className={'btn-red btn btn-outline btn-sm'}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(unit.name, 'de')}
                                        onApprove={() => deleteUnit(unit.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[unit.id] ?? false) ? <span className={'loading loading-spinner'} /> : <></>}
                                  <FaTrashAlt />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className={'text-lg font-bold'}>Umrechnungen</div>
                  <div>Hier können die standardmäßigen Umrechnungen der Einheiten angepasst werden.</div>
                  <div className={'overflow-x-auto'}>
                    <table className={'grid-col-full table-zebra table w-full'}>
                      <thead>
                        <tr>
                          <td>1 Einheit A</td>
                          <td className={'text-right'}>= X</td>
                          <td>Einheit B</td>
                          <td></td>
                          <td className={'flex justify-end'}>
                            <button
                              className={'btn btn-primary btn-sm'}
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
                              Hinzufügen
                            </button>
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {unitConversionsLoading ? (
                          <tr>
                            <td colSpan={5} className={'text-center'}>
                              <Loading />
                            </td>
                          </tr>
                        ) : unitConversions.length == 0 ? (
                          <tr>
                            <td colSpan={5} className={'text-center'}>
                              Keine Einträge vorhanden
                            </td>
                          </tr>
                        ) : (
                          <>
                            {unitConversions
                              .filter((conversion) => !conversion.autoGenerated)
                              .map((conversion) => (
                                <tr key={`unit-conversion-${conversion.id}`}>
                                  <td>{userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de')}</td>
                                  <td className={'text-right'}>
                                    {conversion.factor.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td>{userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de')}</td>
                                  <td>
                                    1 {userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de')} ={' '}
                                    {(1 / conversion.factor).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de')}
                                  </td>
                                  <td className={'flex flex-row justify-end gap-2'}>
                                    <button
                                      className={'btn btn-outline btn-primary btn-sm'}
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
                                      Edit
                                    </button>
                                    <button
                                      disabled={deleting[conversion.id] ?? false}
                                      className={'btn-red btn btn-outline btn-sm'}
                                      onClick={() =>
                                        modalContext.openModal(
                                          <DeleteConfirmationModal
                                            spelling={'DELETE'}
                                            entityName={
                                              userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A', 'de') +
                                              ' zu ' +
                                              userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A', 'de')
                                            }
                                            onApprove={() => deleteUnitConversion(conversion.id)}
                                          />,
                                        )
                                      }
                                    >
                                      {(deleting[conversion.id] ?? false) ? <span className={'loading loading-spinner'} /> : <></>}
                                      <FaTrashAlt />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            <tr onClick={() => setCollapsedGeneratedUnits(!collapsedGeneratedUnits)}>
                              <td colSpan={4} className={'cursor-pointer italic'}>
                                Automatisch generierte Umrechnungen <span className={'underline'}>{!collapsedGeneratedUnits ? 'anzeigen' : 'verbergen'}</span>
                              </td>
                              <td className={'flex items-center justify-end'}>
                                <div className={'p-2'}>{collapsedGeneratedUnits ? <FaArrowUp /> : <FaArrowDown />}</div>
                              </td>
                            </tr>

                            {collapsedGeneratedUnits ? (
                              unitConversions
                                .filter((conversion) => conversion.autoGenerated)
                                .sort((a, b) => a.fromUnitId.localeCompare(b.fromUnitId) || a.toUnitId.localeCompare(b.toUnitId))
                                .map((conversion) => (
                                  <tr key={`unit-conversion-${conversion.id}`}>
                                    <td>{userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A', 'de')}</td>
                                    <td className={'text-right'}>
                                      {conversion.factor.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td>{userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A', 'de')}</td>
                                    <td>
                                      1 {userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A', 'de')} ={' '}
                                      {(1 / conversion.factor).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{' '}
                                      {userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A', 'de')}
                                    </td>
                                    <td className={''}></td>
                                  </tr>
                                ))
                            ) : (
                              <></>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <></>
        )}

        {/*Ice*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'card h-min'}>
            <div className={'card-body'}>
              <div className={'card-title'}>Eis</div>
              <div>Hier lassen sich die unterschiedlichen Eiswürfeltypen anpassen. Beachte, dass das Löschen alle Verweise auf das Eis löscht.</div>
              {iceOptionsLoading ? (
                <div>
                  <Loading />
                </div>
              ) : (
                <>
                  <div className={'overflow-x-auto'}>
                    <table className={'grid-col-full table-zebra table w-full table-auto'}>
                      <thead>
                        <tr>
                          <td>Key</td>
                          <td>Deutsch</td>
                          <td className={'flex flex-row justify-end'}>
                            <button
                              className={'btn btn-primary btn-sm'}
                              onClick={() => {
                                modalContext.openModal(<CreateIceModal />);
                              }}
                            >
                              Hinzufügen
                            </button>
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {iceOptions.length == 0 ? (
                          <tr>
                            <td colSpan={3}>Keine Einträge vorhanden</td>
                          </tr>
                        ) : (
                          iceOptions.map((iceOption, indexIceOption) => (
                            <tr key={`ice-option-${indexIceOption}`}>
                              <td>{iceOption.name}</td>
                              <td>{userContext.getTranslation(iceOption.name, 'de')}</td>
                              <td className={'flex flex-row justify-end gap-2'}>
                                <button
                                  className={'btn btn-outline btn-primary btn-sm'}
                                  onClick={() => {
                                    modalContext.openModal(<EditTranslationModal identifier={iceOption.name} slang={'Eis'} />);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={deleting[iceOption.id] ?? false}
                                  className={'btn-red btn btn-outline btn-sm'}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling={'DELETE'}
                                        entityName={userContext.getTranslation(iceOption.name, 'de')}
                                        onApprove={() => deleteIce(iceOption.id)}
                                      />,
                                    )
                                  }
                                >
                                  {(deleting[iceOption.id] ?? false) ? <span className={'loading loading-spinner'} /> : <></>}
                                  <FaTrashAlt />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <></>
        )}

        {userContext.isUserPermitted(Role.ADMIN) ? (
          <>
            <div className={'col-span-full'}></div>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'card-title'}>Daten Transfer</div>
                <div className={'form-control'}>
                  <input
                    type={'file'}
                    disabled={importing}
                    className={'file-input'}
                    ref={uploadImportFileRef}
                    onChange={(event) => setUploadImportFile(event.target.files?.[0])}
                  />
                </div>
                <button className={`btn btn-primary`} disabled={uploadImportFile == undefined || importing} type={'button'} onClick={importBackup}>
                  {importing ? <span className="loading loading-spinner"></span> : <></>}
                  Import
                </button>
                <button className={`btn btn-primary`} onClick={exportAll} disabled={exporting}>
                  {exporting ? <span className="loading loading-spinner"></span> : <></>}
                  Export All
                </button>
              </div>
            </div>
          </>
        ) : (
          <></>
        )}

        {/*Workspace Dangerous Actions*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'col-span-full'}>
            <div className={'divider'}>Gefahrenbereich</div>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'card-title'}>Gefahrenbereich</div>
                <label className={'label cursor-pointer'}>
                  <span className={'label-text'}>Gefahrenbereich verlassen</span>
                </label>
                <div className={'join'}>
                  <input
                    type={'text'}
                    className={'input join-item w-full'}
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                  />
                  <button
                    className={'btn btn-outline btn-error join-item'}
                    disabled={newWorkspaceName.length < 3 || newWorkspaceName.length > 50}
                    onClick={handleRenameWorkspace}
                  >
                    {workspaceRenaming ? <span className={'loading loading-spinner'} /> : <></>}
                    Umbenennen
                  </button>
                </div>
                <div className={'divider'}></div>
                <button
                  className={'btn btn-outline btn-error'}
                  onClick={() =>
                    modalContext.openModal(
                      <DeleteConfirmationModal onApprove={handleDeleteWorkspace} entityName={'diesen Arbeitsbereich'} spelling={'DELETE'} />,
                    )
                  }
                >
                  {workspaceDeleting ? <span className={'loading loading-spinner'} /> : <></>}
                  Workspace löschen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </ManageEntityLayout>
  );
}

export default withPagePermission(['ADMIN'], WorkspaceSettingPage, '/workspaces/[workspaceId]/manage');
