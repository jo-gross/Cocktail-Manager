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
import { formatDateTime, formatDate } from '@lib/DateUtils';
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardTitle,
  Loading as UiLoading,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@components/ui';

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
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={`Workspace-Einstellungen - ${userContext.workspace?.name}`}>
      <div className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
        {userContext.workspace?.isExternallyManaged && (
          <Alert variant="warning" className="md:col-span-2">
            <FaExclamationTriangle />
            <div>
              <h3 className="font-bold">Extern verwaltete Workspace</h3>
              <div className="text-xs">
                Diese Workspace wird von einem externen Dienst (OpenID) verwaltet. Nutzer und Rollen werden ausschließlich bei der Anmeldung aktualisiert und
                können hier nicht bearbeitet werden.
              </div>
            </div>
          </Alert>
        )}
        <Card className="overflow-y-auto md:col-span-2">
          <CardBody>
            <CardTitle>Workspace Nutzer verwalten</CardTitle>
            <Table zebra className="w-full rounded-xl border border-base-200">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Rolle</TableHeaderCell>
                  <TableHeaderCell>Auth Provider</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workspaceUsersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="w-full text-center">
                      Lade...
                    </TableCell>
                  </TableRow>
                ) : (
                  workspaceUsers
                    ?.sort((a, b) => (a.user.name ?? '').localeCompare(b.user.name ?? ''))
                    .map((workspaceUser) => (
                      <TableRow key={workspaceUser.user.id}>
                        <TableCell className="whitespace-nowrap">
                          {workspaceUser.user.name}
                          {workspaceUser.user.id == userContext.user?.id ? ' (du)' : ''}
                        </TableCell>
                        <TableCell>{workspaceUser.user.email}</TableCell>
                        <TableCell>
                          {userContext.isUserPermitted(Role.ADMIN) ? (
                            <Select
                              selectSize="sm"
                              className="w-full max-w-xs min-w-fit"
                              disabled={
                                workspaceUser.user.id == userContext.user?.id ||
                                workspaceUser.role == Role.OWNER ||
                                (userContext.workspace?.isExternallyManaged &&
                                  workspaceUser.user.accounts?.some((acc: { provider: string }) => acc.provider === 'custom_oidc'))
                              }
                              value={workspaceUser.role}
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
                            </Select>
                          ) : (
                            workspaceUser.role
                          )}
                        </TableCell>
                        <TableCell>
                          {workspaceUser.user.accounts && workspaceUser.user.accounts.length > 0
                            ? workspaceUser.user.accounts[0].provider === 'custom_oidc'
                              ? 'OIDC'
                              : workspaceUser.user.accounts[0].provider
                            : 'Email'}
                        </TableCell>
                        <TableCell className="flex justify-end">
                          {userContext.isUserPermitted(Role.ADMIN) && workspaceUser.user.id != userContext.user?.id ? (
                            <Button
                              variant="error"
                              size="sm"
                              className="ml-2"
                              disabled={
                                workspaceUser.role == Role.OWNER ||
                                (userContext.workspace?.isExternallyManaged &&
                                  workspaceUser.user.accounts?.some((acc: { provider: string }) => acc.provider === 'custom_oidc'))
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
                              {leaveLoading[workspaceUser.userId] ? <UiLoading size="sm" /> : null}
                              {workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}
                            </Button>
                          ) : (
                            <Button
                              variant="error"
                              size="sm"
                              className="ml-2"
                              disabled={
                                workspaceUser.role == Role.OWNER ||
                                workspaceUser.user.id != userContext.user?.id ||
                                leaveLoading[workspaceUser.user.id] ||
                                (userContext.workspace?.isExternallyManaged &&
                                  workspaceUser.user.accounts?.some((acc: { provider: string }) => acc.provider === 'custom_oidc'))
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
                              {leaveLoading[workspaceUser.user.id] ? <UiLoading size="sm" /> : null}
                              {workspaceUser.user.id == userContext.user?.id ? 'Verlassen' : 'Entfernen'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
        {userContext.isUserPermitted(Role.MANAGER) && WorkspaceJoinRequest.length > 0 && (
          <Card className="overflow-y-auto md:col-span-2">
            <CardBody>
              <CardTitle>Beitrittsanfragen</CardTitle>
              <Table zebra className="w-full rounded-xl border border-base-200">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Datum</TableHeaderCell>
                    <TableHeaderCell className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        shape="square"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                        onClick={fetchWorkspaceJoinRequest}
                      >
                        <FaSync />
                      </Button>
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {joinRequestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        Lade...
                      </TableCell>
                    </TableRow>
                  ) : (
                    WorkspaceJoinRequest.sort((a, b) => a.date.getTime() - b.date.getTime()).map((joinRequest) => (
                      <TableRow key={`workspace-join-request-${joinRequest.user.id}`}>
                        <TableCell>{joinRequest.user.name}</TableCell>
                        <TableCell>{joinRequest.user.email}</TableCell>
                        <TableCell>{formatDateTime(new Date(joinRequest.date))}</TableCell>
                        <TableCell>
                          <ButtonGroup className="flex justify-end">
                            <Button
                              type="button"
                              variant="success"
                              joinItem
                              size="sm"
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
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              joinItem
                              size="sm"
                              className="border-error text-error hover:bg-error/10"
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
                            </Button>
                          </ButtonGroup>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        )}
        {userContext.isUserPermitted(Role.MANAGER) && (
          <Card className="overflow-y-auto md:col-span-2">
            <CardBody>
              <CardTitle>Einladungscode</CardTitle>
              <Table zebra className="w-full rounded-xl border border-base-200">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Code</TableHeaderCell>
                    <TableHeaderCell>Erstelldatum</TableHeaderCell>
                    <TableHeaderCell>Ablaufdatum</TableHeaderCell>
                    <TableHeaderCell>Einmal-Code</TableHeaderCell>
                    <TableHeaderCell>Verwendet</TableHeaderCell>
                    <TableHeaderCell className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                        onClick={() => modalContext.openModal(<AddWorkspaceJoinCodeModal onCreated={() => fetchWorkspaceJoinCodes()} />)}
                      >
                        <FaPlus /> Erstellen
                      </Button>
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workspaceJoinCodeLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Lade...
                      </TableCell>
                    </TableRow>
                  ) : workspaceJoinCodes.length == 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Keine Einladungscode vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    workspaceJoinCodes
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((workspaceJoinCode) => (
                        <TableRow key={`workspace-join-request-${workspaceJoinCode.code}`}>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => {
                                navigator.clipboard.writeText(workspaceJoinCode.code).then(() => {
                                  alertService.info('Erfolgreich kopiert');
                                });
                              }}
                            >
                              <FaCopy />
                            </Button>
                            {workspaceJoinCode.code}
                          </TableCell>
                          <TableCell>{formatDate(new Date(workspaceJoinCode.createdAt))}</TableCell>
                          <TableCell>{workspaceJoinCode.expires ? formatDate(new Date(workspaceJoinCode.expires)) : '-'}</TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-primary text-primary hover:bg-primary/10"
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.origin + '/?code=' + workspaceJoinCode.code).then(() => {
                                  alertService.info('Erfolgreich kopiert');
                                });
                              }}
                            >
                              <FaShareAlt />
                              <div>Link kopieren</div>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-error text-error hover:bg-error/10"
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
                                            alertService.error(body.message ?? 'Fehler beim Löschen des Beitrittcodes', response.status, response.statusText);
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
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        )}
      </div>
    </ManageEntityLayout>
  );
}
