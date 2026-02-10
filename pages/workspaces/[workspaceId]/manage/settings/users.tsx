import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Role, User, WorkspaceJoinCode, WorkspaceJoinRequest, WorkspaceUser } from '@generated/prisma/client';
import { alertService } from '@lib/alertService';
import { FaCheck, FaCopy, FaPlus, FaShareAlt, FaSync, FaTimes, FaTrashAlt, FaExclamationTriangle } from 'react-icons/fa';
import AddWorkspaceJoinCodeModal from '../../../../../components/modals/AddWorkspaceJoinCodeModal';
import { FaRegCircle } from 'react-icons/fa6';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import '../../../../../lib/DateUtils';

export default function ManageUsersPage() {
  const router = useRouter();
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const { workspaceId } = router.query;

  const [workspaceUsers, setWorkspaceUsers] = useState<(WorkspaceUser & { user: User & { accounts: { provider: string }[] } })[]>([]);
  const [workspaceUsersLoading, setWorkspaceUsersLoading] = useState<boolean>(false);

  const [WorkspaceJoinRequest, setWorkspaceJoinRequest] = useState<(WorkspaceJoinRequest & { user: User })[]>([]);
  const [workspaceJoinRequestAcceptLoading, setWorkspaceJoinRequestAcceptLoading] = useState<Record<string, boolean>>({});
  const [workspaceJoinRequestRejectLoading, setWorkspaceJoinRequestRejectLoading] = useState<Record<string, boolean>>({});
  const [joinRequestsLoading, setJoinRequestsLoading] = useState<boolean>(false);

  const [workspaceJoinCodes, setWorkspaceJoinCodes] = useState<WorkspaceJoinCode[]>([]);
  const [workspaceJoinCodeLoading, setWorkspaceJoinCodeLoading] = useState<boolean>(false);
  const [workspaceJoinCodeDeleting, setWorkspaceJoinCodeDeleting] = useState<Record<string, boolean>>({});
  const [leaveLoading, setLeaveLoading] = useState<Record<string, boolean>>({});

  const fetchWorkspaceUsers = useCallback(() => {
    if (workspaceId == undefined) return;
    setWorkspaceUsersLoading(true);
    fetch(`/api/workspaces/${workspaceId}/users`)
      .then((response) => {
        if (!response.ok) throw new Error('Error while loading');
        return response.json();
      })
      .then((data) => setWorkspaceUsers(data.data))
      .catch((error) => {
        console.error('SettingsPage -> fetchWorkspaceUsers', error);
        alertService.error('Fehler beim Laden der Benutzer');
      })
      .finally(() => {
        setWorkspaceUsersLoading(false);
      });
  }, [workspaceId]);

  const fetchWorkspaceJoinRequest = useCallback(() => {
    if (workspaceId == undefined) return;
    setJoinRequestsLoading(true);
    fetch(`/api/workspaces/${workspaceId}/join-requests`)
      .then((response) => {
        if (!response.ok) throw new Error('Error while loading');
        return response.json();
      })
      .then((data) => setWorkspaceJoinRequest(data.data))
      .catch((error) => {
        console.error('SettingsPage -> fetchWorkspaceJoinRequest', error);
        alertService.error('Fehler beim Laden der Beitrittsanfragen');
      })
      .finally(() => {
        setJoinRequestsLoading(false);
      });
  }, [workspaceId]);

  const fetchWorkspaceJoinCodes = useCallback(() => {
    if (workspaceId == undefined) return;
    setWorkspaceJoinCodeLoading(true);
    fetch(`/api/workspaces/${workspaceId}/join-codes`)
      .then((response) => {
        if (!response.ok) throw new Error('Error while loading');
        return response.json();
      })
      .then((data) => setWorkspaceJoinCodes(data.data))
      .catch((error) => {
        console.error('SettingsPage -> fetchWorkspaceJoinCodes', error);
        alertService.error('Fehler beim Laden der Beitrittcodes');
      })
      .finally(() => {
        setWorkspaceJoinCodeLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    if (userContext.isUserPermitted(Role.MANAGER)) {
      fetchWorkspaceJoinRequest();
    }
  }, [fetchWorkspaceJoinRequest, userContext]);

  useEffect(() => {
    if (userContext.isUserPermitted(Role.MANAGER)) {
      fetchWorkspaceJoinCodes();
    }
  }, [fetchWorkspaceJoinCodes, userContext]);

  useEffect(() => {
    fetchWorkspaceUsers();
  }, [fetchWorkspaceUsers, workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Workspace-Einstellungen'}>
      <div className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
        {userContext.workspace?.isExternallyManaged && (
          <div role="alert" className="alert alert-warning md:col-span-2">
            <FaExclamationTriangle />
            <div>
              <h3 className="font-bold">Extern verwaltete Workspace</h3>
              <div className="text-xs">
                Diese Workspace wird von einem externen Dienst (OpenID) verwaltet. Nutzer und Rollen werden ausschließlich bei der Anmeldung aktualisiert und
                können hier nicht bearbeitet werden.
              </div>
            </div>
          </div>
        )}
        <div className={'card overflow-y-auto md:col-span-2'}>
          <div className={'card-body'}>
            <div className={'card-title'}>Workspace Nutzer verwalten</div>
            <table className={'table table-zebra w-full rounded-xl border border-base-200'}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Rolle</th>
                  <th>Auth Provider</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workspaceUsersLoading ? (
                  <tr>
                    <td colSpan={5} className={'w-full text-center'}>
                      Lade...
                    </td>
                  </tr>
                ) : (
                  workspaceUsers
                    ?.sort((a, b) => (a.user.name ?? '').localeCompare(b.user.name ?? ''))
                    .map((workspaceUser) => (
                      <tr key={workspaceUser.user.id}>
                        <td className={'whitespace-nowrap'}>
                          {workspaceUser.user.name}
                          {workspaceUser.user.id == userContext.user?.id ? ' (du)' : ''}
                        </td>
                        <td>{workspaceUser.user.email}</td>
                        <td>
                          {userContext.isUserPermitted(Role.ADMIN) ? (
                            <select
                              disabled={
                                workspaceUser.user.id == userContext.user?.id ||
                                workspaceUser.role == Role.OWNER ||
                                (userContext.workspace?.isExternallyManaged && workspaceUser.user.accounts?.some((acc: any) => acc.provider === 'custom_oidc'))
                              }
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
                        <td>
                          {workspaceUser.user.accounts && workspaceUser.user.accounts.length > 0
                            ? workspaceUser.user.accounts[0].provider === 'custom_oidc'
                              ? 'OIDC'
                              : workspaceUser.user.accounts[0].provider
                            : 'Email'}
                        </td>
                        <td className={'flex justify-end'}>
                          {userContext.isUserPermitted(Role.ADMIN) && workspaceUser.user.id != userContext.user?.id ? (
                            <button
                              className={'btn btn-error btn-sm ml-2'}
                              disabled={
                                workspaceUser.role == Role.OWNER ||
                                (userContext.workspace?.isExternallyManaged && workspaceUser.user.accounts?.some((acc: any) => acc.provider === 'custom_oidc'))
                              }
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
                              disabled={
                                workspaceUser.role == Role.OWNER ||
                                workspaceUser.user.id != userContext.user?.id ||
                                leaveLoading[workspaceUser.user.id] ||
                                (userContext.workspace?.isExternallyManaged && workspaceUser.user.accounts?.some((acc: any) => acc.provider === 'custom_oidc'))
                              }
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
                              <>{workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}</>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {userContext.isUserPermitted(Role.MANAGER) && WorkspaceJoinRequest.length > 0 && (
          <div className={'card overflow-y-auto md:col-span-2'}>
            <div className={'card-body'}>
              <div className={'card-title'}>Beitrittsanfragen</div>
              <table className={'table table-zebra w-full rounded-xl border border-base-200'}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Datum</th>
                    <th className={'flex justify-end'}>
                      <button type={'button'} className={'btn btn-square btn-outline btn-primary btn-sm'} onClick={fetchWorkspaceJoinRequest}>
                        <FaSync />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {joinRequestsLoading ? (
                    <tr>
                      <td colSpan={4} className={'text-center'}>
                        Lade...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {WorkspaceJoinRequest.sort((a, b) => a.date.getTime() - b.date.getTime()).map((joinRequest) => (
                        <tr key={`workspace-join-request-${joinRequest.user.id}`}>
                          <td>{joinRequest.user.name}</td>
                          <td>{joinRequest.user.email}</td>
                          <td>{new Date(joinRequest.date).toFormatDateTimeString()}</td>
                          <td className={'join flex justify-end'}>
                            <button
                              className={'btn-green btn join-item btn-sm'}
                              disabled={workspaceJoinRequestAcceptLoading[joinRequest.user.id] || workspaceJoinRequestRejectLoading[joinRequest.user.id]}
                              onClick={() => {
                                setWorkspaceJoinRequestAcceptLoading({ ...workspaceJoinRequestAcceptLoading, [joinRequest.user.id]: true });
                                fetch(`/api/workspaces/${workspaceId}/join-requests/${joinRequest.user.id}/accept`, {
                                  method: 'POST',
                                })
                                  .then(async (response) => {
                                    if (response.ok) {
                                      fetchWorkspaceUsers();
                                      fetchWorkspaceJoinRequest();
                                      alertService.success('Erfolgreich angenommen');
                                    } else {
                                      const body = await response.json();
                                      console.error('SettingsPage -> acceptJoinRequest', response);
                                      alertService.error(body.message ?? 'Fehler beim Annehmen', response.status, response.statusText);
                                    }
                                  })
                                  .catch((error) => {
                                    console.error('SettingsPage -> acceptJoinRequest', error);
                                    alertService.error('Es ist ein Fehler aufgetreten');
                                  })
                                  .finally(() => {
                                    setWorkspaceJoinRequestAcceptLoading({ ...workspaceJoinRequestAcceptLoading, [joinRequest.user.id]: false });
                                  });
                              }}
                            >
                              <FaCheck /> Annehmen
                            </button>
                            <button
                              className={'btn-red btn btn-outline join-item btn-sm'}
                              disabled={workspaceJoinRequestRejectLoading[joinRequest.user.id] || workspaceJoinRequestAcceptLoading[joinRequest.user.id]}
                              onClick={() => {
                                setWorkspaceJoinRequestRejectLoading({ ...workspaceJoinRequestRejectLoading, [joinRequest.user.id]: true });
                                fetch(`/api/workspaces/${workspaceId}/join-requests/${joinRequest.user.id}/reject`, {
                                  method: 'POST',
                                })
                                  .then(async (response) => {
                                    if (response.ok) {
                                      fetchWorkspaceUsers();
                                      fetchWorkspaceJoinRequest();
                                      alertService.success('Erfolgreich abgelehnt');
                                    } else {
                                      const body = await response.json();
                                      console.error('SettingsPage -> acceptJoinRequest', response);
                                      alertService.error(body.message ?? 'Fehler beim Ablehnen', response.status, response.statusText);
                                    }
                                  })
                                  .catch((error) => {
                                    console.error('SettingsPage -> rejectJoinRequest', error);
                                    alertService.error('Es ist ein Fehler aufgetreten');
                                  })
                                  .finally(() => {
                                    setWorkspaceJoinRequestRejectLoading({ ...workspaceJoinRequestRejectLoading, [joinRequest.user.id]: false });
                                  });
                              }}
                            >
                              <FaTimes /> Ablehnen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {userContext.isUserPermitted(Role.MANAGER) && (
          <div className={'card overflow-y-auto md:col-span-2'}>
            <div className={'card-body'}>
              <div className={'card-title'}>Einladungscode</div>
              <table className={'table table-zebra w-full rounded-xl border border-base-200'}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Erstelldatum</th>
                    <th>Ablaufdatum</th>
                    <th>Einmal-Code</th>
                    <th>Verwendet</th>
                    <th className={'flex justify-end'}>
                      <button
                        type={'button'}
                        className={'btn btn-outline btn-primary btn-sm'}
                        onClick={() => modalContext.openModal(<AddWorkspaceJoinCodeModal onCreated={() => fetchWorkspaceJoinCodes()} />)}
                      >
                        <FaPlus /> Erstellen
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workspaceJoinCodeLoading ? (
                    <tr>
                      <td colSpan={6} className={'text-center'}>
                        Lade...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {workspaceJoinCodes.length == 0 ? (
                        <tr>
                          <td colSpan={6} className={'text-center'}>
                            Keine Einladungscode vorhanden
                          </td>
                        </tr>
                      ) : (
                        workspaceJoinCodes
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((workspaceJoinCode) => (
                            <tr key={`workspace-join-request-${workspaceJoinCode.code}`}>
                              <td>
                                <button
                                  className={'btn btn-ghost btn-primary btn-sm'}
                                  onClick={() => {
                                    navigator.clipboard.writeText(workspaceJoinCode.code).then(() => {
                                      alertService.info('Erfolgreich kopiert');
                                    });
                                  }}
                                >
                                  <FaCopy />
                                </button>
                                {workspaceJoinCode.code}
                              </td>
                              <td>{new Date(workspaceJoinCode.createdAt).toFormatDateString()}</td>
                              <td>{workspaceJoinCode.expires ? new Date(workspaceJoinCode.expires).toFormatDateString() : '-'}</td>
                              <td>
                                {workspaceJoinCode.onlyUseOnce ? (
                                  <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <FaRegCircle style={{ fontSize: '24px' }} />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                      }}
                                    >
                                      1
                                    </span>
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>
                                {workspaceJoinCode.onlyUseOnce ? (
                                  workspaceJoinCode.used > 0 ? (
                                    <FaCheck />
                                  ) : (
                                    '-'
                                  )
                                ) : workspaceJoinCode.used == 0 ? (
                                  '-'
                                ) : (
                                  workspaceJoinCode.used
                                )}
                              </td>
                              <td className={'flex justify-end gap-2'}>
                                <button
                                  className={'btn btn-outline btn-primary btn-sm'}
                                  onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin + '/?code=' + workspaceJoinCode.code).then(() => {
                                      alertService.info('Erfolgreich kopiert');
                                    });
                                  }}
                                >
                                  <FaShareAlt />
                                  <div>Link kopieren</div>
                                </button>
                                <button
                                  className={'btn-red btn btn-outline btn-sm'}
                                  disabled={workspaceJoinCodeDeleting[workspaceJoinCode.code]}
                                  onClick={() => {
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        onApprove={async () => {
                                          setWorkspaceJoinCodeDeleting({ ...workspaceJoinCodeDeleting, [workspaceJoinCode.code]: true });
                                          fetch(`/api/workspaces/${workspaceId}/join-codes/${workspaceJoinCode.code}`, {
                                            method: 'DELETE',
                                          })
                                            .then(async (response) => {
                                              if (response.ok) {
                                                fetchWorkspaceJoinCodes();
                                                alertService.success('Erfolgreich entfernt');
                                              } else {
                                                const body = await response.json();
                                                console.error('SettingsPage -> deleteWorkspaceJoinCode', response);
                                                alertService.error(
                                                  body.message ?? 'Fehler beim Löschen des Beitrittcodes',
                                                  response.status,
                                                  response.statusText,
                                                );
                                              }
                                            })
                                            .catch((error) => {
                                              console.error('SettingsPage -> deleteWorkspaceJoinCode', error);
                                              alertService.error('Es ist ein Fehler aufgetreten');
                                            })
                                            .finally(() => {
                                              setWorkspaceJoinCodeDeleting({ ...workspaceJoinCodeDeleting, [workspaceJoinCode.code]: false });
                                            });
                                        }}
                                        spelling={'DELETE'}
                                        entityName={`den Beitrittscode '${workspaceJoinCode.code}'`}
                                      />,
                                    );
                                  }}
                                >
                                  <FaTrashAlt />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ManageEntityLayout>
  );
}
