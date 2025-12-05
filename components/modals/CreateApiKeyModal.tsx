import React, { useState, useContext } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import ApiKeyPermissionSelector from '../api-keys/ApiKeyPermissionSelector';
import { Permission } from '@generated/prisma/client';
import { FaCopy } from 'react-icons/fa';

interface CreateApiKeyModalProps {
  apiKeyId?: string;
  initialName?: string;
  initialExpiresAt?: string | null;
  initialPermissions?: Array<{ permission: Permission; endpointPattern?: string | null }>;
}

export default function CreateApiKeyModal(props: CreateApiKeyModalProps) {
  const modalContext = useContext(ModalContext);
  const router = useRouter();
  const { workspaceId } = router.query;

  const [name, setName] = useState(props.initialName || '');
  const [expiresAt, setExpiresAt] = useState(props.initialExpiresAt || '');
  const [permissions, setPermissions] = useState<Array<{ permission: Permission; endpointPattern?: string | null }>>(props.initialPermissions || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isEditing] = useState(!!props.apiKeyId);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alertService.error('Name ist erforderlich');
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        permissions: permissions,
      };

      let response;
      if (isEditing && props.apiKeyId) {
        response = await fetch(`/api/workspaces/${workspaceId}/api-keys/${props.apiKeyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch(`/api/workspaces/${workspaceId}/api-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (response.ok) {
        const data = await response.json();
        if (data.data.key && !isEditing) {
          // Show the key only once
          setCreatedKey(data.data.key);
        } else {
          // For edits, just close and reload
          router.reload();
          modalContext.closeModal();
        }
      } else {
        const error = await response.json();
        alertService.error(error.message || 'Fehler beim Erstellen des API Keys');
      }
    } catch (error) {
      console.error('CreateApiKeyModal -> handleSubmit', error);
      alertService.error('Fehler beim Erstellen des API Keys');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alertService.success('API Key in Zwischenablage kopiert');
    } catch (error) {
      console.error('Failed to copy:', error);
      alertService.error('Fehler beim Kopieren');
    }
  };

  const handleContinue = () => {
    router.reload();
    modalContext.closeModal();
  };

  if (createdKey) {
    return (
      <div className="flex flex-col gap-4 md:min-w-[32rem]">
        <div className="text-2xl font-bold">API Key erstellt</div>
        <div className="text-warning">
          <strong>Wichtig:</strong> Dieser API Key wird nur einmal angezeigt. Speichern Sie ihn sicher.
        </div>
        <div className="flex flex-col gap-2">
          <label className="label">
            <span className="label-text font-semibold">API Key:</span>
          </label>
          <div className="join">
            <input type="text" readOnly value={createdKey} className="input join-item input-bordered flex-1 font-mono" />
            <button className="btn btn-primary join-item" onClick={() => copyToClipboard(createdKey)} title="In Zwischenablage kopieren">
              <FaCopy />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-primary" onClick={handleContinue}>
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:min-w-[32rem]">
      <div className="text-2xl font-bold">{isEditing ? 'API Key bearbeiten' : 'API Key erstellen'}</div>

      <div className="flex flex-col gap-2">
        <label className="label">
          <span className="label-text font-semibold">Name:</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input input-bordered"
          placeholder="z.B. Production API Key"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="label">
          <span className="label-text font-semibold">Ablaufdatum (optional):</span>
        </label>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input input-bordered" disabled={isSubmitting} />
      </div>

      <ApiKeyPermissionSelector selectedPermissions={permissions} onChange={setPermissions} />

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={() => modalContext.closeModal()} disabled={isSubmitting}>
          Abbrechen
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? <span className="loading loading-spinner" /> : <></>}
          {isEditing ? 'Speichern' : 'Erstellen'} ({permissions.length})
        </button>
      </div>
    </div>
  );
}
