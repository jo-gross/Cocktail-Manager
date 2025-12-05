import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Role, Permission } from '@generated/prisma/client';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import CreateApiKeyModal from '../../../../../components/modals/CreateApiKeyModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { alertService } from '@lib/alertService';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { Loading } from '@components/Loading';

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
  permissions: Array<{
    permission: Permission;
    endpointPattern: string | null;
  }>;
}

function ApiKeysPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);
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

  const handleEdit = (apiKey: ApiKey) => {
    modalContext.openModal(
      <CreateApiKeyModal apiKeyId={apiKey.id} initialName={apiKey.name} initialExpiresAt={apiKey.expiresAt} initialPermissions={apiKey.permissions} />,
      false,
    );
    // Reload after modal closes
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
      return new Date(dateString).toLocaleString('de-DE');
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
        <button key="create" className="btn btn-primary" onClick={handleCreate}>
          <FaPlus />
          API Key erstellen
        </button>,
      ]}
    >
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-lg font-bold">API Keys verwalten</div>
            <div className="text-sm text-base-content/70">
              Erstellen Sie API Keys, um externen Diensten kontrollierten Zugriff auf Ihr Workspace zu gewähren. Jeder Key kann spezifische Berechtigungen
              haben.
            </div>

            {apiKeys.length === 0 ? (
              <div className="mt-4 text-center">
                <div className="text-lg">Keine API Keys vorhanden</div>
                <button className="btn btn-outline btn-primary mt-4" onClick={handleCreate}>
                  <FaPlus />
                  Ersten API Key erstellen
                </button>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Erstellt am</th>
                      <th>Ablaufdatum</th>
                      <th>Zuletzt verwendet</th>
                      <th>Erstellt von</th>
                      <th>Berechtigungen</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((apiKey, index) => (
                      <tr key={apiKey.id} className={isExpired(apiKey.expiresAt) ? 'opacity-50' : ''}>
                        <td>
                          <div className="font-semibold">{apiKey.name}</div>
                          <div className="font-mono text-xs text-base-content/60">{apiKey.keyPrefix}</div>
                        </td>
                        <td>{formatDate(apiKey.createdAt)}</td>
                        <td>
                          {apiKey.expiresAt ? (
                            <span className={isExpired(apiKey.expiresAt) ? 'text-error' : ''}>{formatDate(apiKey.expiresAt)}</span>
                          ) : (
                            <span className="text-base-content/60">Nie</span>
                          )}
                        </td>
                        <td>{formatDate(apiKey.lastUsedAt)}</td>
                        <td>{apiKey.createdBy.name || apiKey.createdBy.email || 'Unbekannt'}</td>
                        <td>
                          {apiKey.permissions.length > 0 ? (
                            <div className={`tooltip ${index == 0 ? 'tooltip-left' : ''}`} data-tip={apiKey.permissions.map((p) => p.permission).join(', ')}>
                              <div className="badge badge-primary badge-sm cursor-help">
                                {apiKey.permissions.length} Berechtigung{apiKey.permissions.length !== 1 ? 'en' : ''}
                              </div>
                            </div>
                          ) : (
                            <div className="badge badge-primary badge-sm">
                              {apiKey.permissions.length} Berechtigung{apiKey.permissions.length !== 1 ? 'en' : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(apiKey)} disabled={deleting === apiKey.id}>
                              <FaEdit />
                            </button>
                            <button className="btn btn-error btn-sm" onClick={() => handleDelete(apiKey)} disabled={deleting === apiKey.id}>
                              {deleting === apiKey.id ? <span className="loading loading-spinner" /> : <FaTrash />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}

export default withPagePermission(['ADMIN', 'OWNER'], ApiKeysPage, '/workspaces/[workspaceId]/manage');
