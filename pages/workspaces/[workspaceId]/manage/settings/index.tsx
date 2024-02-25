import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { alertService } from '../../../../../lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { $Enums, Role, Signage, User, WorkspaceCocktailRecipeStepAction, WorkspaceUser } from '@prisma/client';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { FaShareAlt, FaTrashAlt } from 'react-icons/fa';
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
  const [leaveLoading, setLeaveLoading] = useState<boolean>(false);
  const [workspaceDeleting, setWorkspaceDeleting] = useState<boolean>(false);
  const [workspaceRenaming, setWorkspaceRenaming] = useState<boolean>(false);

  const [workspaceActions, setWorkspaceActions] = useState<WorkspaceCocktailRecipeStepAction[]>([]);
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<boolean>(false);

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
        fetchCocktailRecipeActions();
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

  const fetchCocktailRecipeActions = useCallback(() => {
    if (workspaceId == undefined) return;
    setWorkspaceActionLoading(true);
    fetch(`/api/workspaces/${workspaceId}/actions`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setWorkspaceActions(body.data);
        } else {
          console.error('SettingsPage -> fetchCocktailRecipeActions', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktail-Rezept-Aktionen', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('SettingsPage -> fetchCocktailRecipeActions', error);
        alertService.error('Fehler beim Laden der Cocktail-Rezept-Aktionen');
      })
      .finally(() => setWorkspaceActionLoading(false));
  }, [workspaceId]);

  const [actionDeleting, setActionDeleting] = useState<{ [key: string]: boolean }>({});

  const deleteCocktailRecipeAction = useCallback(
    async (actionId: string) => {
      if (workspaceId == undefined) return;
      if (actionDeleting[actionId] ?? false) return;
      setActionDeleting({ ...actionDeleting, [actionId]: true });
      fetch(`/api/workspaces/${workspaceId}/actions/${actionId}`, {
        method: 'DELETE',
      })
        .then(async (response) => {
          if (response.ok) {
            fetchCocktailRecipeActions();
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
          setActionDeleting({ ...actionDeleting, [actionId]: false });
        });
    },
    [actionDeleting, fetchCocktailRecipeActions, workspaceId],
  );

  useEffect(() => {
    fetchWorkspaceUsers();
    fetchSignage();
    fetchCocktailRecipeActions();
  }, [fetchCocktailRecipeActions, fetchSignage, fetchWorkspaceUsers]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Workspace-Einstellungen'}>
      <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
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
                              });
                          }}
                        >
                          <>{workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}</>
                        </button>
                      ) : (
                        <button
                          className={'btn btn-error btn-sm ml-2'}
                          disabled={workspaceUser.role == Role.OWNER || leaveLoading}
                          onClick={() => {
                            setLeaveLoading(true);
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
                                setLeaveLoading(false);
                              });
                          }}
                        >
                          <span className={leaveLoading ? 'loading loading-spinner' : ''} />
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
        {userContext.isUserPermitted(Role.ADMIN) ? (
          <div className={'col-span-1'}>
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
                            <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={() => setHorizontalImage(undefined)} />,
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
                            <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={() => setVerticalImage(undefined)} />,
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
                  <table className={'table-compact grid-col-full table w-full'}>
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
                              disabled={actionDeleting[action.id] ?? false}
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
                              {actionDeleting[action.id] ?? false ? <span className={'loading loading-spinner'} /> : <></>}
                              <FaTrashAlt />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </table>
                  <div className={'text-lg font-bold'}>Gruppen</div>
                  <div>Diese können bei den Methoden erstellt werden, hier kannst du die passende Anzeige einstellen</div>
                  <table className={'table-compact grid-col-full table w-full'}>
                    <thead>
                      <tr>
                        <td>Key</td>
                        <td>Deutsch</td>
                        <td></td>
                      </tr>
                    </thead>
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
                  </table>
                </>
              )}
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </ManageEntityLayout>
  );
}
