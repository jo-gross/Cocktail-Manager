import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import ApiKeyPermissionSelector from '../api-keys/ApiKeyPermissionSelector';
import { Permission } from '@generated/prisma/client';
import { FaCopy } from 'react-icons/fa';
import { Button, ButtonGroup, FormControl, Input, Label, LabelText, Loading } from '@components/ui';
import { createApiKey } from '@lib/network/apiKeys';
import { alertApiV1Error } from '@lib/network/apiV1';

interface CreateApiKeyModalProps {
  initialName?: string;
  initialExpiresAt?: string | null;
  initialPermissions?: Permission[];
  viewOnly?: boolean;
}

export default function CreateApiKeyModal(props: CreateApiKeyModalProps) {
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;

  const [name, setName] = useState(props.initialName || '');
  const [expiresAt, setExpiresAt] = useState(props.initialExpiresAt ? new Date(props.initialExpiresAt).toISOString().split('T')[0] : '');
  const [permissions, setPermissions] = useState<Permission[]>(props.initialPermissions || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const viewOnly = props.viewOnly || false;

  const handleSubmit = async () => {
    if (!name.trim()) {
      alertService.error(t('common:name'));
      return;
    }
    if (!workspaceId) return;

    setIsSubmitting(true);
    try {
      const result = await createApiKey(workspaceId, {
        name: name.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        permissions: permissions,
      });
      if (result.key) {
        setCreatedKey(result.key);
      }
    } catch (error) {
      alertApiV1Error(error, t('errors:create'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alertService.success(t('common:success.copied'));
    } catch (error) {
      console.error('Failed to copy:', error);
      alertService.error(t('errors:copy'));
    }
  };

  const handleContinue = () => {
    router.reload();
    modalContext.closeModal();
  };

  if (createdKey) {
    return (
      <div className="flex flex-col gap-4 md:min-w-[32rem]">
        <div className="text-2xl font-bold">{t('settings:apiKeyCreated')}</div>
        <div className="text-warning">
          <strong>{t('settings:apiKeyImportantPrefix')}</strong>
          {t('settings:apiKeyImportantSuffix')}
        </div>
        <FormControl>
          <Label>
            <LabelText className="font-semibold">{t('settings:apiKeyLabel')}</LabelText>
          </Label>
          <ButtonGroup className="w-full">
            <Input type="text" readOnly value={createdKey} joinItem className="flex-1 font-mono" />
            <Button joinItem variant="primary" onClick={() => copyToClipboard(createdKey)} title={t('common:copy')}>
              <FaCopy />
            </Button>
          </ButtonGroup>
        </FormControl>
        <div className="flex justify-end gap-2">
          <Button variant="primary" onClick={handleContinue}>
            {t('common:done')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:min-w-[32rem]">
      <div className="text-2xl font-bold">{viewOnly ? t('settings:apiKeyDetails') : t('settings:apiKeysCreate')}</div>

      <FormControl>
        <Label>
          <LabelText className="font-semibold">{t('settings:nameColon')}</LabelText>
        </Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings:apiKeyNamePlaceholder')}
          disabled={isSubmitting || viewOnly}
          readOnly={viewOnly}
        />
      </FormControl>

      <FormControl>
        <Label>
          <LabelText className="font-semibold">{t('settings:apiKeyExpiresOptional')}</LabelText>
        </Label>
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={isSubmitting || viewOnly} readOnly={viewOnly} />
      </FormControl>

      <ApiKeyPermissionSelector selectedPermissions={permissions} onChange={setPermissions} disabled={viewOnly} />

      <div className="flex justify-end gap-2">
        {viewOnly ? (
          <Button variant="primary" onClick={() => modalContext.closeModal()}>
            {t('common:close')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => modalContext.closeModal()} disabled={isSubmitting}>
              {t('common:cancel')}
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? <Loading size="sm" /> : null}
              {t('common:createWithCount', { count: permissions.length })}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
