import React, { useCallback, useContext, useEffect, useState } from 'react';
import { alertService } from '../../../../../lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { $Enums, Role, Signage, User, WorkspaceUser } from '@prisma/client';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { FaShareAlt, FaTrashAlt } from 'react-icons/fa';
import { DeleteConfirmationModal } from '../../../../../components/modals/DeleteConfirmationModal';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';
import { UploadDropZone } from '../../../../../components/UploadDropZone';
import { compressFile } from '../../../../../lib/ImageCompressor';
import { convertToBase64 } from '../../../../../lib/Base64Converter';
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

  const [selectedFile, setSelectedFile] = useState<File>();

  const [verticalImageLoading, setVerticalImageLoading] = useState<boolean>(false);
  const [verticalImage, setVerticalImage] = useState<string>();
  const [verticalImageColor, setVerticalImageColor] = useState<string>();
  const [horizontalImageLoading, setHorizontalImageLoading] = useState<boolean>(false);
  const [horizontalImage, setHorizontalImage] = useState<string>();
  const [horizontalImageColor, setHorizontalImageColor] = useState<string>();
  const [updatingSignage, setUpdatingSignage] = useState<boolean>(false);

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch(`/api/workspaces/${workspaceId}/admin/backups/export`)
      .then((response) => response.text())
      .then((content) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = 'backup.json';
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
      })
      .catch((e) => {
        console.log(e);
        alertService.error('Fehler beim Exportieren');
      })
      .finally(() => setExporting(false));
  }, [workspaceId]);

  const importBackup = useCallback(async () => {
    try {
      if (selectedFile == undefined) return;
      setImporting(true);

      const data: BackupStructure = JSON.parse(await selectedFile.text());

      const response = await fetch(`/api/workspaces/${workspaceId}/admin/backups/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.ok) {
        alertService.success(`Import erfolgreich`);
      } else {
        const body = await response.json();
        console.log('Admin -> ImportBackup', response, body);
        alertService.error(body.message, response.status, response.statusText);
      }
    } catch (e) {
      alertService.error(`Fehler beim importieren`);
    } finally {
      setImporting(false);
    }
  }, [selectedFile, workspaceId]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!confirm('Workspace inkl. aller Zutaten und Rezepte wirklich löschen?')) return;

    fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    }).then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        router.replace('/').then(() => alertService.success('Erfolgreich gelöscht'));
      } else {
        console.log('Admin -> DeleteWorkspace', response, body);
        alertService.error(body.message, response.status, response.statusText);
      }
    });
  }, [router, workspaceId]);

  const handleRenameWorkspace = useCallback(async () => {
    fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newWorkspaceName }),
    }).then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setNewWorkspaceName('');
        alertService.success(`Umbenennen erfolgreich`);
      } else {
        console.log('Admin -> RenameWorkspace', response, body);
        alertService.error(body.message, response.status, response.statusText);
      }
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
          console.log('Admin -> UpdateSignage', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((e) => {
        console.log(e);
        alertService.error('Fehler beim Update, z.B. zu große Datei');
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
      .catch((e) => {
        console.log(e);
        alertService.error('Fehler beim Laden der Benutzer');
      });
  }, [workspaceId]);

  const fetchSignage = useCallback(() => {
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
      .finally();
  }, []);

  useEffect(() => {
    fetchWorkspaceUsers();

    fetchSignage();
  }, [fetchSignage, fetchWorkspaceUsers]);

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
                          navigator.clipboard.writeText(workspaceId as string);
                          alertService.info('Erfolgreich kopiert');
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
                              .then((response) => {
                                if (response.ok) {
                                  fetchWorkspaceUsers();
                                } else {
                                  throw new Error('Fehler beim aktualisieren');
                                }
                              })
                              .then(() => alertService.success('Erfolgreich aktualisiert'))
                              .catch((error) => alertService.error(error.message));
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
                              .then((response) => {
                                if (response.ok) {
                                  fetchWorkspaceUsers();
                                } else {
                                  throw new Error('Fehler beim entfernen');
                                }
                              })
                              .then(() => alertService.success('Erfolgreich entfernt'))
                              .catch((error) => alertService.error(error.message));
                          }}
                        >
                          <>{workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}</>
                        </button>
                      ) : (
                        <button
                          className={'btn btn-error btn-sm ml-2'}
                          disabled={workspaceUser.role == Role.OWNER}
                          onClick={() => {
                            fetch(`/api/workspaces/${workspaceId}/leave`, {
                              method: 'POST',
                            })
                              .then(async (response) => {
                                if (response.ok) {
                                  router.replace('/').then(() => alertService.success('Erfolgreich verlassen'));
                                } else {
                                  const body = await response.json();
                                  alertService.error(body.message, response.status, response.statusText);
                                }
                              })
                              .catch((error) => alertService.error(error.message));
                          }}
                        >
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
                  onChange={(e) => setSelectedFile(e.target.files?.[0])}
                />
              </div>
              <button
                className={`btn btn-primary`}
                disabled={selectedFile == undefined || importing}
                type={'button'}
                onClick={importBackup}
              >
                <>{importing ? <span className="loading loading-spinner"></span> : <></>}</>
                Import
              </button>
              <button className={`btn btn-primary`} onClick={exportAll} disabled={exporting}>
                <>{exporting ? <span className="loading loading-spinner"></span> : <></>}</>
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
                    Umbenennen
                  </button>
                </div>
                <div className={'divider'}></div>
                <button
                  className={'btn btn-outline btn-error'}
                  onClick={() =>
                    modalContext.openModal(
                      <DeleteConfirmationModal onApprove={handleDeleteWorkspace} spelling={'DELETE'} />,
                    )
                  }
                >
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
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/signage?id=${workspaceId}`);
                    alertService.info('In Zwischenablage kopiert');
                  }}
                  className={'btn btn-square btn-ghost'}
                >
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
                            <DeleteConfirmationModal
                              spelling={'REMOVE'}
                              entityName={'das Bild'}
                              onApprove={() => setHorizontalImage(undefined)}
                            />,
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
                      onChange={(e) => {
                        setHorizontalImageColor(e.target.value);
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
                            <DeleteConfirmationModal
                              spelling={'REMOVE'}
                              entityName={'das Bild'}
                              onApprove={() => setVerticalImage(undefined)}
                            />,
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
                      onChange={(e) => {
                        setVerticalImageColor(e.target.value);
                      }}
                      className={'input w-full'}
                    />
                  </div>
                </div>
              </div>
              <button
                className={`btn btn-primary ${updatingSignage ? 'btn-loading' : ''}`}
                onClick={handleUpdateSignage}
              >
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </ManageEntityLayout>
  );
}
