import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSection } from '@components/settings/SettingsSection';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import CreateApiKeyModal from '../../../../../components/modals/CreateApiKeyModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { alertService } from '@lib/alertService';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { formatDate as formatDateUtil } from '@lib/DateUtils';
import { Badge, Button, Loading as UiLoading, SkeletonTableRows, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';
import type { ApiKeyDto } from '@lib/schemas/apiKeys';
import { fetchApiKeysSafe, deleteApiKey } from '@lib/network/apiKeys';
import { alertApiV1Error } from '@lib/network/apiV1';

function ApiKeysPage() {
  const { t } = useTranslation(['settings', 'common', 'manage', 'nav', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;
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

  const columns = 7;

  return (
    <SettingsLayout page="apiKeys">
      <SettingsSection
        title={t('settings:apiKeysManage')}
        description={t('settings:apiKeysHelpLong')}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={handleCreate}>
            <FaPlus aria-hidden />
            {t('settings:apiKeysCreate')}
          </Button>
        }
      >
        {!loading && apiKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-base-300 p-6 text-center">
            <div className="text-lg">{t('settings:apiKeysEmpty')}</div>
            <Button type="button" variant="outline" onClick={handleCreate}>
              <FaPlus aria-hidden />
              {t('settings:apiKeysCreateFirst')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-300/60">
            <Table zebra className="w-full">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('common:name')}</TableHeaderCell>
                  <TableHeaderCell>{t('settings:createdOn')}</TableHeaderCell>
                  <TableHeaderCell>{t('manage:expiresAt')}</TableHeaderCell>
                  <TableHeaderCell>{t('settings:lastUsed')}</TableHeaderCell>
                  <TableHeaderCell>{t('settings:createdBy')}</TableHeaderCell>
                  <TableHeaderCell>{t('settings:permissions')}</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">{t('common:actions')}</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows columns={columns} rows={3} avatarColumn={-1} />
                ) : (
                  apiKeys.map((apiKey) => {
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
                        <TableCell className={expired ? 'opacity-50' : ''}>{apiKey.createdBy.name || apiKey.createdBy.email || t('common:unknown')}</TableCell>
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
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline-error"
                              size="sm"
                              aria-label={`${t('common:delete')}: ${apiKey.name}`}
                              onClick={() => handleDelete(apiKey)}
                              disabled={deleting === apiKey.id}
                            >
                              {deleting === apiKey.id ? <UiLoading size="sm" /> : <FaTrash aria-hidden />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsSection>
    </SettingsLayout>
  );
}

export default withPagePermission(['ADMIN', 'OWNER'], ApiKeysPage, '/workspaces/[workspaceId]/manage');
