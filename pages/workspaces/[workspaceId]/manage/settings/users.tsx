import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Role } from '@generated/prisma/client';
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
import type { WorkspaceUserDto } from '@lib/schemas/workspaceUsers';
import type { JoinRequestDto } from '@lib/schemas/joinRequests';
import type { JoinCodeDto } from '@lib/schemas/joinCodes';
import { fetchWorkspaceUsers, fetchWorkspaceJoinRequests, fetchWorkspaceJoinCodes } from '@lib/network/workspaceUsers';
import { ApiV1RequestError, apiV1Mutate } from '@lib/network/apiV1';

export default function ManageUsersPage() {
  const { t } = useTranslation(['settings', 'common', 'manage', 'errors', 'entity']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const { workspaceId } = router.query;
  const isExternallyManaged = Boolean(userContext.workspace?.isExternallyManaged);

  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserDto[]>([]);
  const [workspaceUsersLoading, setWorkspaceUsersLoading] = useState<boolean>(false);

  const [workspaceJoinRequests, setWorkspaceJoinRequests] = useState<JoinRequestDto[]>([]);
  const [workspaceJoinRequestAcceptLoading, setWorkspaceJoinRequestAcceptLoading] = useState<Record<string, boolean>>({});
  const [workspaceJoinRequestRejectLoading, setWorkspaceJoinRequestRejectLoading] = useState<Record<string, boolean>>({});
  const [joinRequestsLoading, setJoinRequestsLoading] = useState<boolean>(false);

  const [workspaceJoinCodes, setWorkspaceJoinCodes] = useState<JoinCodeDto[]>([]);
  const [workspaceJoinCodeLoading, setWorkspaceJoinCodeLoading] = useState<boolean>(false);
  const [workspaceJoinCodeDeleting, setWorkspaceJoinCodeDeleting] = useState<Record<string, boolean>>({});
  const [leaveLoading, setLeaveLoading] = useState<Record<string, boolean>>({});

  const loadWorkspaceUsers = useCallback(() => {
    fetchWorkspaceUsers(workspaceId, setWorkspaceUsers, setWorkspaceUsersLoading);
  }, [workspaceId]);

  const loadWorkspaceJoinRequests = useCallback(() => {
    fetchWorkspaceJoinRequests(workspaceId, setWorkspaceJoinRequests, setJoinRequestsLoading);
  }, [workspaceId]);

  const loadWorkspaceJoinCodes = useCallback(() => {
    fetchWorkspaceJoinCodes(workspaceId, setWorkspaceJoinCodes, setWorkspaceJoinCodeLoading);
  }, [workspaceId]);

  useEffect(() => {
    if (userContext.isUserPermitted(Role.MANAGER)) {
      loadWorkspaceJoinRequests();
    }
  }, [loadWorkspaceJoinRequests, userContext]);

  useEffect(() => {
    if (userContext.isUserPermitted(Role.MANAGER)) {
      loadWorkspaceJoinCodes();
    }
  }, [loadWorkspaceJoinCodes, userContext]);

  useEffect(() => {
    loadWorkspaceUsers();
  }, [loadWorkspaceUsers]);

  const handleMutationError = (error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiV1RequestError) {
      alertService.error(error.message || fallbackMessage, error.status, error.code);
      return;
    }
    console.error(fallbackMessage, error);
    alertService.error(fallbackMessage);
  };

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={t('settings:title', { name: userContext.workspace?.name ?? '' })}>
      <div className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
        {isExternallyManaged && (
          <Alert variant="warning" className="md:col-span-2">
            <FaExclamationTriangle />
            <div>
              <h3 className="font-bold">{t('settings:externallyManaged')}</h3>
              <div className="text-xs">{t('manage:externallyManagedHelp')}</div>
            </div>
          </Alert>
        )}
        <Card className="overflow-y-auto md:col-span-2">
          <CardBody>
            <CardTitle>{t('settings:usersTitle')}</CardTitle>
            <Table zebra className="w-full rounded-xl border border-base-200">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                  <TableHeaderCell>{t('manage:email')}</TableHeaderCell>
                  <TableHeaderCell>{t('settings:role')}</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workspaceUsersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="w-full text-center">
                      {t('common:loadingShort')}
                    </TableCell>
                  </TableRow>
                ) : (
                  [...workspaceUsers]
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                    .map((workspaceUser) => {
                      const isCurrentUser = workspaceUser.userId === userContext.user?.id;
                      const membershipLocked = workspaceUser.role === Role.OWNER || isExternallyManaged;

                      return (
                        <TableRow key={workspaceUser.userId}>
                          <TableCell className="whitespace-nowrap">
                            {workspaceUser.name}
                            {isCurrentUser ? ' (du)' : ''}
                          </TableCell>
                          <TableCell>{workspaceUser.email}</TableCell>
                          <TableCell>
                            {userContext.isUserPermitted(Role.ADMIN) ? (
                              <Select
                                selectSize="sm"
                                className="w-full max-w-xs min-w-fit"
                                disabled={isCurrentUser || membershipLocked}
                                value={workspaceUser.role}
                                onChange={(event) => {
                                  apiV1Mutate<WorkspaceUserDto>(`/api/v1/workspaces/${workspaceId}/users/${workspaceUser.userId}`, 'PUT', {
                                    role: event.target.value,
                                  })
                                    .then(() => {
                                      loadWorkspaceUsers();
                                      userContext.refreshWorkspace();
                                      alertService.success(t('common:success.updated'));
                                    })
                                    .catch((error) => handleMutationError(error, t('errors:updateRole')));
                                }}
                              >
                                {Object.values(Role)
                                  .filter((role) => (workspaceUser.role === Role.OWNER ? true : role !== Role.OWNER))
                                  .map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                              </Select>
                            ) : (
                              workspaceUser.role
                            )}
                          </TableCell>
                          <TableCell className="flex justify-end">
                            {userContext.isUserPermitted(Role.ADMIN) && !isCurrentUser ? (
                              <Button
                                variant="error"
                                size="sm"
                                className="ml-2"
                                disabled={membershipLocked || leaveLoading[workspaceUser.userId]}
                                onClick={() => {
                                  setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: true });
                                  apiV1Mutate(`/api/v1/workspaces/${workspaceId}/users/${workspaceUser.userId}`, 'DELETE')
                                    .then(() => {
                                      loadWorkspaceUsers();
                                      userContext.refreshWorkspace();
                                      alertService.success(t('common:success.removed'));
                                    })
                                    .catch((error) => handleMutationError(error, t('errors:remove')))
                                    .finally(() => {
                                      setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: false });
                                    });
                                }}
                              >
                                {leaveLoading[workspaceUser.userId] ? <UiLoading size="sm" /> : null}
                                {t('common:remove')}
                              </Button>
                            ) : (
                              <Button
                                variant="error"
                                size="sm"
                                className="ml-2"
                                disabled={membershipLocked || !isCurrentUser || leaveLoading[workspaceUser.userId]}
                                onClick={() => {
                                  setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: true });
                                  apiV1Mutate(`/api/v1/workspaces/${workspaceId}/leave`, 'POST')
                                    .then(() => {
                                      router.replace('/').then(() => alertService.success(t('common:success.left')));
                                    })
                                    .catch((error) => handleMutationError(error, t('errors:leaveWorkspace')))
                                    .finally(() => {
                                      setLeaveLoading({ ...leaveLoading, [workspaceUser.userId]: false });
                                    });
                                }}
                              >
                                {leaveLoading[workspaceUser.userId] ? <UiLoading size="sm" /> : null}
                                {t('settings:leave')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
        {userContext.isUserPermitted(Role.MANAGER) && workspaceJoinRequests.length > 0 && (
          <Card className="overflow-y-auto md:col-span-2">
            <CardBody>
              <CardTitle>{t('manage:joinRequests')}</CardTitle>
              <Table zebra className="w-full rounded-xl border border-base-200">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                    <TableHeaderCell>{t('manage:email')}</TableHeaderCell>
                    <TableHeaderCell>{t('manage:date')}</TableHeaderCell>
                    <TableHeaderCell className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        shape="square"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                        onClick={loadWorkspaceJoinRequests}
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
                        {t('common:loadingShort')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...workspaceJoinRequests]
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((joinRequest) => (
                        <TableRow key={`workspace-join-request-${joinRequest.userId}`}>
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
                                disabled={
                                  isExternallyManaged ||
                                  workspaceJoinRequestAcceptLoading[joinRequest.userId] ||
                                  workspaceJoinRequestRejectLoading[joinRequest.userId]
                                }
                                onClick={() => {
                                  setWorkspaceJoinRequestAcceptLoading({ ...workspaceJoinRequestAcceptLoading, [joinRequest.userId]: true });
                                  apiV1Mutate(`/api/v1/workspaces/${workspaceId}/join-requests/${joinRequest.userId}/accept`, 'POST')
                                    .then(() => {
                                      loadWorkspaceUsers();
                                      loadWorkspaceJoinRequests();
                                      userContext.refreshWorkspace();
                                      alertService.success(t('common:success.accepted'));
                                    })
                                    .catch((error) => handleMutationError(error, t('errors:accept')))
                                    .finally(() => {
                                      setWorkspaceJoinRequestAcceptLoading({ ...workspaceJoinRequestAcceptLoading, [joinRequest.userId]: false });
                                    });
                                }}
                              >
                                <FaCheck /> {t('manage:accept')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                joinItem
                                size="sm"
                                className="border-error text-error hover:bg-error/10"
                                disabled={
                                  isExternallyManaged ||
                                  workspaceJoinRequestRejectLoading[joinRequest.userId] ||
                                  workspaceJoinRequestAcceptLoading[joinRequest.userId]
                                }
                                onClick={() => {
                                  setWorkspaceJoinRequestRejectLoading({ ...workspaceJoinRequestRejectLoading, [joinRequest.userId]: true });
                                  apiV1Mutate(`/api/v1/workspaces/${workspaceId}/join-requests/${joinRequest.userId}/reject`, 'POST')
                                    .then(() => {
                                      loadWorkspaceUsers();
                                      loadWorkspaceJoinRequests();
                                      alertService.success(t('common:success.rejected'));
                                    })
                                    .catch((error) => handleMutationError(error, t('errors:reject')))
                                    .finally(() => {
                                      setWorkspaceJoinRequestRejectLoading({ ...workspaceJoinRequestRejectLoading, [joinRequest.userId]: false });
                                    });
                                }}
                              >
                                <FaTimes /> {t('manage:reject')}
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
              <CardTitle>{t('settings:invitationCodes')}</CardTitle>
              <Table zebra className="w-full rounded-xl border border-base-200">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t('manage:code')}</TableHeaderCell>
                    <TableHeaderCell>{t('settings:createdAt')}</TableHeaderCell>
                    <TableHeaderCell>{t('manage:expiresAt')}</TableHeaderCell>
                    <TableHeaderCell>{t('manage:singleUseCode')}</TableHeaderCell>
                    <TableHeaderCell>{t('settings:used')}</TableHeaderCell>
                    <TableHeaderCell className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                        disabled={isExternallyManaged}
                        onClick={() => modalContext.openModal(<AddWorkspaceJoinCodeModal onCreated={() => loadWorkspaceJoinCodes()} />)}
                      >
                        <FaPlus /> {t('common:create')}
                      </Button>
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workspaceJoinCodeLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        {t('common:loadingShort')}
                      </TableCell>
                    </TableRow>
                  ) : workspaceJoinCodes.length == 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        {t('manage:noInvitationCodes')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...workspaceJoinCodes]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((workspaceJoinCode) => (
                        <TableRow key={`workspace-join-code-${workspaceJoinCode.code}`}>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => {
                                navigator.clipboard.writeText(workspaceJoinCode.code).then(() => {
                                  alertService.info(t('common:success.copied'));
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
                                  alertService.info(t('common:success.copied'));
                                });
                              }}
                            >
                              <FaShareAlt />
                              <div>{t('common:copyLink')}</div>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-error text-error hover:bg-error/10"
                              disabled={isExternallyManaged || workspaceJoinCodeDeleting[workspaceJoinCode.code]}
                              onClick={() => {
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    onApprove={async () => {
                                      setWorkspaceJoinCodeDeleting({ ...workspaceJoinCodeDeleting, [workspaceJoinCode.code]: true });
                                      apiV1Mutate(`/api/v1/workspaces/${workspaceId}/join-codes/${workspaceJoinCode.code}`, 'DELETE')
                                        .then(() => {
                                          loadWorkspaceJoinCodes();
                                          alertService.success(t('common:success.removed'));
                                        })
                                        .catch((error) => handleMutationError(error, t('errors:deleteJoinCode')))
                                        .finally(() => {
                                          setWorkspaceJoinCodeDeleting({ ...workspaceJoinCodeDeleting, [workspaceJoinCode.code]: false });
                                        });
                                    }}
                                    spelling={'DELETE'}
                                    entityName={t('entity:theJoinCode', { name: workspaceJoinCode.code })}
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
