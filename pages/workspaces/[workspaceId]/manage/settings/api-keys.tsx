import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Permission } from '@generated/prisma/client';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import CreateApiKeyModal from '../../../../../components/modals/CreateApiKeyModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { alertService } from '@lib/alertService';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { Loading } from '@components/Loading';
import { formatDate as formatDateUtil } from '@lib/DateUtils';
import { Badge, Button, Card, CardBody, Loading as UiLoading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  permissions: Permission[];
}

function ApiKeysPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const _userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    if (!workspaceId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.data || []);
      } else {
        alertService.error('Fehler beim Laden der API Keys');
      }
    } catch (error) {
      console.error('fetchApiKeys', error);
      alertService.error('Fehler beim Laden der API Keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [workspaceId]);

  const handleCreate = () => {
    modalContext.openModal(<CreateApiKeyModal />, false);
    // Reload after modal closes (handled by modal)
    setTimeout(() => {
      fetchApiKeys();
    }, 500);
  };

  const handleDelete = (apiKey: ApiKey) => {
    modalContext.openModal(
      <DeleteConfirmationModal
        entityName={apiKey.name}
        spelling="DELETE"
        onApprove={async () => {
          setDeleting(apiKey.id);
          try {
            const response = await fetch(`/api/workspaces/${workspaceId}/api-keys/${apiKey.id}`, {
              method: 'DELETE',
            });
            if (response.ok) {
              alertService.success('API Key erfolgreich gelöscht');
              fetchApiKeys();
            } else {
              const error = await response.json();
              alertService.error(error.message || 'Fehler beim Löschen des API Keys');
            }
          } catch (error) {
            console.error('handleDelete', error);
            alertService.error('Fehler beim Löschen des API Keys');
          } finally {
            setDeleting(null);
          }
        }}
      />,
      false,
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nie';
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
      <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title="API Keys">
        <Loading />
      </ManageEntityLayout>
    );
  }

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title="API Keys"
      actions={[
        <Button key="create" type="button" variant="primary" onClick={handleCreate}>
          <FaPlus />
          API Key erstellen
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardBody>
            <div className="text-lg font-bold">API Keys verwalten</div>
            <div className="text-sm text-base-content/70">
              Erstellen Sie API Keys, um externen Diensten kontrollierten Zugriff auf Ihr Workspace zu gewähren. Jeder Key kann spezifische Berechtigungen
              haben.
            </div>

            {apiKeys.length === 0 ? (
              <div className="mt-4 text-center">
                <div className="text-lg">Keine API Keys vorhanden</div>
                <Button type="button" variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/10" onClick={handleCreate}>
                  <FaPlus />
                  Ersten API Key erstellen
                </Button>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <Table zebra className="w-full">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Name</TableHeaderCell>
                      <TableHeaderCell>Erstellt am</TableHeaderCell>
                      <TableHeaderCell>Ablaufdatum</TableHeaderCell>
                      <TableHeaderCell>Zuletzt verwendet</TableHeaderCell>
                      <TableHeaderCell>Erstellt von</TableHeaderCell>
                      <TableHeaderCell>Berechtigungen</TableHeaderCell>
                      <TableHeaderCell>Aktionen</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map((apiKey, _index) => {
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
                              <span className="text-base-content/60">Nie</span>
                            )}
                          </TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>{formatDate(apiKey.lastUsedAt)}</TableCell>
                          <TableCell className={expired ? 'opacity-50' : ''}>{apiKey.createdBy.name || apiKey.createdBy.email || 'Unbekannt'}</TableCell>
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
                                {apiKey.permissions.length} Berechtigung{apiKey.permissions.length !== 1 ? 'en' : ''}
                              </Badge>
                            ) : (
                              <Badge variant="primary" size="sm">
                                {apiKey.permissions.length} Berechtigung{apiKey.permissions.length !== 1 ? 'en' : ''}
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
