import React, { useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button, Loading } from '@components/ui';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { deleteWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { alertService } from '@lib/alertService';
import { SettingsSection } from './SettingsSection';

export function DangerZoneSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const router = useRouter();
  const modalContext = useContext(ModalContext);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t('settings:deleteWorkspaceConfirm'))) return;
    setDeleting(true);
    try {
      await deleteWorkspace(workspaceId);
      await router.replace('/');
      alertService.success(t('common:success.deleted'));
    } catch (error) {
      alertApiV1Error(error, t('errors:deleteWorkspace'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsSection tone="danger" title={t('settings:dangerZone')} description={t('settings:general.dangerHelp')}>
      <div className="flex flex-col gap-3 rounded-xl border border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('settings:deleteWorkspace')}</span>
          <span className="text-sm text-base-content/70">{t('settings:general.deleteHelp')}</span>
        </div>
        <Button
          type="button"
          variant="outline-error"
          className="shrink-0"
          disabled={deleting}
          onClick={() =>
            modalContext.openModal(<DeleteConfirmationModal onApprove={handleDelete} entityName={t('settings:thisWorkspace')} spelling={'DELETE'} />)
          }
        >
          {deleting ? <Loading size="sm" /> : null}
          {t('settings:deleteWorkspace')}
        </Button>
      </div>
    </SettingsSection>
  );
}
