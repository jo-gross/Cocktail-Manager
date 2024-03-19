import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { alertService } from '../../../../../lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { $Enums, Role, Signage, Unit, UnitConversion, User, WorkspaceCocktailRecipeStepAction, WorkspaceUser } from '@prisma/client';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { FaArrowDown, FaArrowUp, FaShareAlt, FaTrashAlt } from 'react-icons/fa';
import { DeleteConfirmationModal } from '../../../../../components/modals/DeleteConfirmationModal';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';
import { UploadDropZone } from '../../../../../components/UploadDropZone';
import { compressFile } from '../../../../../lib/ImageCompressor';
import { convertToBase64 } from '../../../../../lib/Base64Converter';
import '../../../../../lib/DateUtils';
import { Loading } from '../../../../../components/Loading';
import _ from 'lodash';
import CocktailStepActionModal from '../../../../../components/modals/CocktailStepActionModal';
import CocktailStepActionGroupModal from '../../../../../components/modals/CocktailStepActionGroupModal';
import UnitModal from '../../../../../components/modals/UnitModal';
import UnitConversionModal from '../../../../../components/modals/UnitConversionModal';
import { fetchUnitConversions, fetchUnits } from '../../../../../lib/network/units';
import { fetchActions } from '../../../../../lib/network/actions';
import MonitorFormat = $Enums.MonitorFormat;

export default function WorkspaceSettingPage() {
  const router = useRouter();
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const { workspaceId } = router.query;

  const [workspaceUsers, setWorkspaceUsers] = useState<(WorkspaceUser & { user: User })[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');

  const [exporting, setExporting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

  const [uploadImportFile, setUploadImportFile] = useState<File>();
  const uploadImportFileRef = useRef<HTMLInputElement>(null);

  const [verticalImage, setVerticalImage] = useState<string>();
  const [verticalImageColor, setVerticalImageColor] = useState<string>();
  const [horizontalImage, setHorizontalImage] = useState<string>();
  const [horizontalImageColor, setHorizontalImageColor] = useState<string>();
  const [updatingSignage, setUpdatingSignage] = useState<boolean>(false);

  const [copyToClipboardLoading, setCopyToClipboardLoading] = useState<boolean>(false);
  const [leaveLoading, setLeaveLoading] = useState<Record<string, boolean>>({});
  const [workspaceDeleting, setWorkspaceDeleting] = useState<boolean>(false);
  const [workspaceRenaming, setWorkspaceRenaming] = useState<boolean>(false);

  const [workspaceActions, setWorkspaceActions] = useState<WorkspaceCocktailRecipeStepAction[]>([]);
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<boolean>(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState<boolean>(false);

  const [unitConversions, setUnitConversions] = useState<UnitConversion[]>([]);
  const [unitConversionsLoading, setUnitConversionsLoading] = useState<boolean>(false);

  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});

  const [collapsedGeneratedUnits, setCollapsedGeneratedUnits] = useState<boolean>(true);

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch(`/api/workspaces/${workspaceId}/admin/backups/export`)
      .then((response) => response.text())
      .then((content) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `Cocktail-Manager ${userContext.workspace?.name} Backup ${new Date().toFormatDateString()}.json`;
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
      })
      .catch((error) => {
        console.error('Settings-Page -> exportAll', error);
        alertService.error('Fehler beim Exportieren');
      })
      .finally(() => setExporting(false));
  }, [workspaceId]);

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
      if (response.ok) {
        fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
        alertService.success(`Import erfolgreich`);
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
  }, [uploadImportFile, workspaceId]);

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
          userContext.refreshWorkspace();
          setNewWorkspaceName('');
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
  }, [newWorkspaceName, workspaceId]);

  const handleUpdateSignage = useCallback(async () => {
    setUpdatingSignage(true);
    fetch(`/api/workspaces/${workspaceId}/admin/signage`, {
      method: 'PUT',
      body: JSON.stringify({
        verticalContent: verticalImage,
        horizontalContent: horizontalImage,
        verticalBgColor: verticalImageColor,
        horizontalBgColor: horizontalImageColor,
      }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          alertService.success(`Update erfolgreich`);
        } else {
          console.error('Admin -> UpdateSignage', response);
          alertService.error(body.message ?? 'Fehler beim Speichern', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('SettingsPage -> handleUpdateSignage', error);
        alertService.error('Es ist ein Fehler Aufgetreten, z.B. zu große Datei');
      })
      .finally(() => {
        setUpdatingSignage(false);
      });
  }, [horizontalImage, horizontalImageColor, verticalImage, verticalImageColor, workspaceId]);

  const fetchWorkspaceUsers = useCallback(() => {
    if (workspaceId == undefined) return;
    fetch(`/api/workspaces/${workspaceId}/users`)
      .then((response) => {
        if (!response.ok) throw new Error('Error while loading');
        return response.json();
      })
      .then((data) => setWorkspaceUsers(data.data))
      .catch((error) => {
        console.error('SettingsPage -> fetchWorkspaceUsers', error);
        alertService.error('Fehler beim Laden der Benutzer');
      });
  }, [workspaceId]);

  const fetchSignage = useCallback(() => {
    if (workspaceId == undefined) return;

    fetch(`/api/signage/${workspaceId}`)
      .then(async (response) => {
        return response.json();
      })
      .then((data) => {
        data.content.forEach((signage: Signage) => {
          if (signage.format == MonitorFormat.PORTRAIT) {
            setVerticalImage(signage.content);
            setVerticalImageColor(signage.backgroundColor ?? undefined);
          } else {
            setHorizontalImage(signage.content);
            setHorizontalImageColor(signage.backgroundColor ?? undefined);
          }
        });
      })
      .catch((error) => {
        console.error('SettingsPage -> fetchSignage', error);
        alertService.error('Fehler beim Laden der Monitor-Einstellungen');
      });
  }, [workspaceId]);

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
    [deleting, fetchUnitConversions, workspaceId],
  );

  useEffect(() => {
    fetchWorkspaceUsers();
    fetchSignage();
    fetchActions(workspaceId, setWorkspaceActions, setWorkspaceActionLoading);
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
    fetchUnitConversions(workspaceId, setUnitConversionsLoading, setUnitConversions);
  }, [fetchSignage, fetchWorkspaceUsers, workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Workspace-Einstellungen'}>
      <div className={'grid grid-flow-row-dense grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
        <div className={'card overflow-y-auto md:col-span-2'}>
          <div className={'card-body'}>
            <div className={'card-title'}>Workspace Nutzer verwalten</div>
            <table className={'table w-full rounded-xl border border-base-200'}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Rolle</th>
                  <th className={'flex justify-end'}>
                    {userContext.isUserPermitted(Role.ADMIN) && (
                      <button
                        className={'btn btn-outline btn-primary btn-sm'}
                        onClick={() => {
                          navigator.clipboard.writeText(workspaceId as string).then(() => {
                            alertService.info('Erfolgreich kopiert');
                          });
                        }}
                      >
                        <FaShareAlt />
                        <div>Einladungs-Code kopieren</div>
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {workspaceUsers?.map((workspaceUser) => (
                  <tr key={workspaceUser.user.id}>
                    <td className={'whitespace-nowrap'}>
                      {workspaceUser.user.name}
                      {workspaceUser.user.id == userContext.user?.id ? ' (du)' : ''}
                    </td>
                    <td>{workspaceUser.user.email}</td>
                    <td>
                      {userContext.isUserPermitted(Role.ADMIN) ? (
                        <select
                          disabled={workspaceUser.user.id == userContext.user?.id || workspaceUser.role == Role.OWNER}
                          value={workspaceUser.role}
                          className={'select select-bordered select-sm w-full min-w-fit max-w-xs'}
                          onChange={(event) => {
                            fetch(`/api/workspaces/${workspaceId}/users/${workspaceUser.userId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: workspaceUser.userId, role: event.target.value }),
                            })
                              .then(async (response) => {
                                if (response.ok) {
                                  fetchWorkspaceUsers();
                                  alertService.success('Erfolgreich aktualisiert');
                                } else {
                                  const body = await response.json();
                                  console.error('SettingsPage -> updateUserRole', response);
                                  alertService.error(body.message ?? 'Fehler beim aktualisieren', response.status, response.statusText);
                                }
                              })
                              .catch((error) => {
                                console.error('SettingsPage -> updateUserRole', error);
                                alertService.error('Es ist ein Fehler aufgetreten');
                              });
                          }}
                        >
                          {Object.values(Role)
                            .filter((role) => (workspaceUser.role == Role.OWNER ? true : role != Role.OWNER))
                            .map((role) => (
                              <option key={role}>{role}</option>
                            ))}
                        </select>
                      ) : (
                        workspaceUser.role
                      )}
                    </td>
                    <td className={'flex justify-end'}>
                      {userContext.isUserPermitted(Role.ADMIN) ? (
                        <button
                          className={'btn btn-error btn-sm ml-2'}
                          disabled={workspaceUser.role == Role.OWNER}
                          onClick={() => {
                            setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: true });
                            fetch(`/api/workspaces/${workspaceId}/users/${workspaceUser.userId}`, {
                              method: 'DELETE',
                            })
                              .then(async (response) => {
                                if (response.ok) {
                                  fetchWorkspaceUsers();
                                  alertService.success('Erfolgreich entfernt');
                                } else {
                                  const body = await response.json();
                                  console.error('SettingsPage -> removeUser', response);
                                  alertService.error(body.message ?? 'Fehler beim Entfernen', response.status, response.statusText);
                                }
                              })
                              .catch((error) => {
                                console.error('SettingsPage -> removeUser', error);
                                alertService.error('Es ist ein Fehler aufgetreten');
                              })
                              .finally(() => {
                                setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: false });
                              });
                          }}
                        >
                          {leaveLoading[workspaceUser.userId] ? <span className={'loading loading-spinner'} /> : <></>}
                          <>{workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}</>
                        </button>
                      ) : (
                        <button
                          className={'btn btn-error btn-sm ml-2'}
                          disabled={workspaceUser.role == Role.OWNER || leaveLoading[workspaceUser.user.id]}
                          onClick={() => {
                            setLeaveLoading({ ...leaveLoading, [workspaceUser.user.id]: true });

                            fetch(`/api/workspaces/${workspaceId}/leave`, {
                              method: 'POST',
                            })
                              .then(async (response) => {
                                if (response.ok) {
                                  router.replace('/').then(() => alertService.success('Erfolgreich verlassen'));
                                } else {
                                  const body = await response.json();
                                  console.error('SettingsPage -> leaveWorkspace', response);
                                  alertService.error(body.message ?? 'Fehler beim Verlassen der Workspace', response.status, response.statusText);
                                }
                              })
                              .catch((error) => {
                                console.error('SettingsPage -> leaveWorkspace', error);
                                alertService.error('Fehler beim Verlassen der Workspace');
                              })
                              .finally(() => {
                                setLeaveLoading({ ...leaveLoading, [workspaceUser.user.id]: false });
                              });
                          }}
                        >
                          {leaveLoading[workspaceUser.user.id] ? <span className={'loading loading-spinner'} /> : <></>}
                          Verlassen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'card'}>
            <div className={'card-body'}>
              <div className={'card-title'}>Daten Transfer</div>
              <div className={'form-control'}>
                <input
                  type={'file'}
                  disabled={importing}
                  className={'file-input file-input-bordered'}
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
        ) : (
          <></>
        )}

        {/*Signage*/}
        {userContext.isUserPermitted(Role.MANAGER) ? (
          <div className={'card'}>
            <div className={'card-body'}>
              <div className={'card-title w-full justify-between'}>
                <div>Monitor</div>
                <button
                  onClick={async () => {
                    setCopyToClipboardLoading(true);
                    await navigator.clipboard.writeText(`${window.location.origin}/signage?id=${workspaceId}`);
                    setCopyToClipboardLoading(false);
                    alertService.info('In Zwischenablage kopiert');
                  }}
                  className={'btn btn-square btn-ghost'}
                >
                  {copyToClipboardLoading ? <span className={'loading loading-spinner'} /> : <></>}
                  <FaShareAlt />
                </button>
              </div>
              <div className={'grid grid-cols-2 gap-2'}>
                <div className={'flex flex-col gap-2'}>
                  <div>Horizontal</div>
                  {horizontalImage == undefined ? (
                    <UploadDropZone
                      maxUploadSize={'1MB'}
                      onSelectedFilesChanged={async (file) => {
                        if (file) {
                          const compressedImageFile = await compressFile(file);
                          const base = await convertToBase64(compressedImageFile);
                          setHorizontalImage(base);
                        } else {
                          alertService.error('Datei konnte nicht ausgewählt werden.');
                        }
                      }}
                    />
                  ) : (
                    <div className={'relative h-full'}>
                      <div
                        className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2'}
                        onClick={() =>
                          modalContext.openModal(
                            <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={async () => setHorizontalImage(undefined)} />,
                          )
                        }
                      >
                        <FaTrashAlt />
                      </div>
                      <img className={'rounded-lg'} src={horizontalImage} alt={'Fehler beim darstellen der Karte'} />
                    </div>
                  )}
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Hintergrundfarbe</span>
                    </label>
                    <input
                      type={'color'}
                      disabled={horizontalImage == undefined}
                      value={horizontalImageColor}
                      onChange={(event) => {
                        setHorizontalImageColor(event.target.value);
                      }}
                      className={'input w-full'}
                    />
                  </div>
                </div>

                <div className={'flex flex-col gap-2'}>
                  <div>Vertikal</div>
                  {verticalImage == undefined ? (
                    <UploadDropZone
                      maxUploadSize={'1MB'}
                      onSelectedFilesChanged={async (file) => {
                        if (file) {
                          const compressedImageFile = await compressFile(file);
                          const base = await convertToBase64(compressedImageFile);
                          setVerticalImage(base);
                        } else {
                          alertService.error('Datei konnte nicht ausgewählt werden.');
                        }
                      }}
                    />
                  ) : (
                    <div className={'relative h-full'}>
                      <div
                        className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2'}
                        onClick={() =>
                          modalContext.openModal(
                            <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={async () => setVerticalImage(undefined)} />,
                          )
                        }
                      >
                        <FaTrashAlt />
                      </div>
                      <img className={'rounded-lg'} src={verticalImage} alt={'Fehler beim darstellen der Karte'} />
                    </div>
                  )}
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Hintergrundfarbe</span>
                    </label>
                    <input
                      type={'color'}
                      disabled={verticalImage == undefined}
                      value={verticalImageColor}
                      onChange={(event) => {
                        setVerticalImageColor(event.target.value);
                      }}
                      className={'input w-full'}
                    />
                  </div>
                </div>
              </div>
              <button className={`btn btn-primary`} onClick={handleUpdateSignage}>
                {updatingSignage ? <span className={'loading loading-spinner'} /> : <></>}
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <></>
        )}
        {/*Cocktail Recipe Actions*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'card'}>
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
                  <table className={'grid-col-full table table-zebra w-full'}>
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
                                className={'btn-red btn btn-outline btn-sm '}
                                onClick={() =>
                                  modalContext.openModal(
                                    <DeleteConfirmationModal
                                      onApprove={() => deleteCocktailRecipeAction(action.id)}
                                      spelling={'DELETE'}
                                      entityName={userContext.getTranslation(action.name, 'de')}
                                    />,
                                  )
                                }
                              >
                                {deleting[action.id] ?? false ? <span className={'loading loading-spinner'} /> : <></>}
                                <FaTrashAlt />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className={'text-lg font-bold'}>Gruppen</div>
                  <div>Diese können bei den Methoden erstellt werden, hier kannst du die passende Anzeige einstellen</div>
                  <table className={'grid-col-full table table-zebra w-full'}>
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
                                  modalContext.openModal(<CocktailStepActionGroupModal actionGroup={group} />);
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
                </>
              )}
            </div>
          </div>
        ) : (
          <></>
        )}
        {/*Workspace Units*/}
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'card'}>
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
                  <table className={'grid-col-full table table-zebra w-full'}>
                    <thead>
                      <tr>
                        <td>Key</td>
                        <td>Deutsch</td>
                        <td className={'flex flex-row justify-end'}>
                          <button
                            className={'btn btn-primary btn-sm'}
                            onClick={() => {
                              modalContext.openModal(<UnitModal unit={undefined} />);
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
                                className={'btn-red btn btn-outline btn-sm '}
                                onClick={() =>
                                  modalContext.openModal(
                                    <DeleteConfirmationModal
                                      onApprove={() => deleteUnit(unit.id)}
                                      spelling={'DELETE'}
                                      entityName={userContext.getTranslation(unit.name, 'de')}
                                    />,
                                  )
                                }
                              >
                                {deleting[unit.id] ?? false ? <span className={'loading loading-spinner'} /> : <></>}
                                <FaTrashAlt />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className={'text-lg font-bold'}>Umrechnungen</div>
                  <div>Hier können die standardmäßigen Umrechnungen der Einheiten angepasst werden.</div>
                  <table className={'grid-col-full table table-zebra w-full'}>
                    <thead>
                      <tr>
                        <td>Von Einheit ...</td>
                        <td>* Faktor</td>
                        <td>... zu Einheit</td>
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
                          <td colSpan={4} className={'text-center'}>
                            <Loading />
                          </td>
                        </tr>
                      ) : unitConversions.length == 0 ? (
                        <tr>
                          <td colSpan={4} className={'text-center'}>
                            Keine Einträge vorhanden
                          </td>
                        </tr>
                      ) : (
                        <>
                          {unitConversions
                            .filter((conversion) => !conversion.autoGenerated)
                            .map((conversion) => (
                              <tr key={`unit-conversion-${conversion.id}`}>
                                <td>
                                  {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
                                </td>
                                <td>{1 / conversion.factor}</td>
                                <td>
                                  {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
                                </td>
                                <td>
                                  1 {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de') ?? 'Lade ...'} ={' '}
                                  {conversion.factor}{' '}
                                  {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
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
                                    className={'btn-red btn btn-outline btn-sm '}
                                    onClick={() =>
                                      modalContext.openModal(
                                        <DeleteConfirmationModal
                                          onApprove={() => deleteUnitConversion(conversion.id)}
                                          spelling={'DELETE'}
                                          entityName={
                                            userContext.getTranslation(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? 'N/A', 'de') +
                                            ' zu ' +
                                            userContext.getTranslation(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? 'N/A', 'de')
                                          }
                                        />,
                                      )
                                    }
                                  >
                                    {deleting[conversion.id] ?? false ? <span className={'loading loading-spinner'} /> : <></>}
                                    <FaTrashAlt />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          <tr onClick={() => setCollapsedGeneratedUnits(!collapsedGeneratedUnits)}>
                            <td colSpan={4}>Automatisch generierte Umrechnungen</td>
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
                                  <td>
                                    {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
                                  </td>
                                  <td>{1 / conversion.factor}</td>
                                  <td>
                                    {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
                                  </td>
                                  <td>
                                    1 {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.toUnitId)?.name ?? '', 'de') ?? 'Lade ...'} ={' '}
                                    {conversion.factor}{' '}
                                    {userContext.getTranslationOrNull(units.find((unit) => unit.id == conversion.fromUnitId)?.name ?? '', 'de') ?? 'Lade ...'}
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
                </>
              )}
            </div>
          </div>
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
                    className={'input join-item input-bordered w-full'}
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
                  onClick={() => modalContext.openModal(<DeleteConfirmationModal onApprove={handleDeleteWorkspace} spelling={'DELETE'} />)}
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
