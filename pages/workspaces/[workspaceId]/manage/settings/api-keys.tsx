import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import CreateApiKeyModal from '../../../../../components/modals/CreateApiKeyModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { alertService } from '@lib/alertService';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { Loading } from '@components/Loading';
import { formatDate as formatDateUtil } from '@lib/DateUtils';
import { Badge, Button, Card, CardBody, Loading as UiLoading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';
import type { ApiKeyDto } from '@lib/schemas/apiKeys';
import { fetchApiKeysSafe, deleteApiKey } from '@lib/network/apiKeys';
import { alertApiV1Error } from '@lib/network/apiV1';

function ApiKeysPage() {
  const { t } = useTranslation(['settings', 'common', 'manage', 'nav', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;
  const _userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadApiKeys = () => {
    fetchApiKeysSafe(workspaceId, setApiKeys, setLoading);
  };

  useEffect(() => {
    loadApiKeys();
  }, [workspaceId]);

  const handleCreate = () => {
    modalContext.openModal(<CreateApiKeyModal />, false);
    // Reload after modal closes (handled by modal)
    setTimeout(() => {
      loadApiKeys();
    }, 500);
  };

  const handleDelete = (apiKey: ApiKeyDto) => {
    modalContext.openModal(
      <DeleteConfirmationModal
        entityName={apiKey.name}
        spelling="DELETE"
        onApprove={async () => {
          if (!workspaceId) return;
          setDeleting(apiKey.id);
          try {
            await deleteApiKey(workspaceId, apiKey.id);
            alertService.success(t('entity:apiKeyDeleted'));
            loadApiKeys();
          } catch (error) {
            alertApiV1Error(error, t('errors:deleteApiKey'));
          } finally {
            setDeleting(null);
          }
        }}
      />,
      false,
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('common:never');
    try {
      return formatDateUtil(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={t('nav:apiKeys')}>
        <Loading />
      </ManageEntityLayout>
    );
  }

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={t('nav:apiKeys')}
      actions={[
        <Button key="create" type="button" variant="primary" onClick={handleCreate}>
          <FaPlus />
          {t('settings:apiKeysCreate')}
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardBody>
            <div className="text-lg font-bold">{t('settings:apiKeysManage')}</div>
            <div className="text-sm text-base-content/70">{t('settings:apiKeysHelpLong')}</div>

            {apiKeys.length === 0 ? (
              <div className="mt-4 text-center">
                <div className="text-lg">{t('settings:apiKeysEmpty')}</div>
                <Button type="button" variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/10" onClick={handleCreate}>
                  <FaPlus />
                  {t('settings:apiKeysCreateFirst')}
                </Button>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <Table zebra className="w-full">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                      <TableHeaderCell>{t('settings:createdOn')}</TableHeaderCell>
                      <TableHeaderCell>{t('manage:expiresAt')}</TableHeaderCell>
                      <TableHeaderCell>{t('settings:lastUsed')}</TableHeaderCell>
                      <TableHeaderCell>{t('settings:createdBy')}</TableHeaderCell>
                      <TableHeaderCell>{t('settings:permissions')}</TableHeaderCell>
                      <TableHeaderCell>{t('common:actions')}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map((apiKey) => {
                      const expired = isExpired(apiKey.expiresAt);
                      return (
                        <TableRow key={apiKey.id}>
                          <TableCell className={expired ? 'opacity-50' : ''}>
                            <div className="font-semibold">{apiKey.name}</div>
                            <div className="font-mono text-xs text-base-content/60">{apiKey.keyPrefix}</div>
                          </TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>{formatDate(apiKey.createdAt)}</TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>
                            {apiKey.expiresAt ? (
                              <span className={expired ? 'text-error' : ''}>{formatDate(apiKey.expiresAt)}</span>
                            ) : (
                              <span className="text-base-content/60">{t('common:never')}</span>
                            )}
                          </TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>{formatDate(apiKey.lastUsedAt)}</TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>
                            {apiKey.createdBy.name || apiKey.createdBy.email || t('common:unknown')}
                          </TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>
                            {apiKey.permissions.length > 0 ? (
                              <Badge
                                variant="primary"
                                size="sm"
                                className="cursor-help"
                                onClick={() => {
                                  modalContext.openModal(
                                    <CreateApiKeyModal
                                      initialName={apiKey.name}
                                      initialExpiresAt={apiKey.expiresAt}
                                      initialPermissions={apiKey.permissions}
                                      viewOnly={true}
                                    />,
                                    false,
                                  );
                                }}
                              >
                                {t('manage:permission', { count: apiKey.permissions.length })}
                              </Badge>
                            ) : (
                              <Badge variant="primary" size="sm">
                                {t('manage:permission', { count: apiKey.permissions.length })}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button type="button" variant="error" size="sm" onClick={() => handleDelete(apiKey)} disabled={deleting === apiKey.id}>
                                {deleting === apiKey.id ? <UiLoading size="sm" /> : <FaTrash />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </ManageEntityLayout>
  );
}

export default withPagePermission(['ADMIN', 'OWNER'], ApiKeysPage, '/workspaces/[workspaceId]/manage');
