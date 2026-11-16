import React, { useContext, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Loading } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { updateWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { alertService } from '@lib/alertService';
import { SettingsSection } from './SettingsSection';
import { isValidWorkspaceName, WorkspaceNameField } from './WorkspaceNameField';

export function WorkspaceNameSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors', 'entity']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const currentName = workspace?.name ?? '';
  // null = untouched, i.e. follow the current workspace name.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = draft ?? currentName;

  const trimmed = name.trim();
  const invalid = !isValidWorkspaceName(name);
  const changed = trimmed !== currentName;
  useReportUnsavedChanges(draft !== null && changed);

  const save = async () => {
    if (invalid || !changed) return;
    setSaving(true);
    try {
      await updateWorkspace(workspaceId, { name: trimmed });
      await refreshWorkspace();
      setDraft(null);
      alertService.success(t('entity:renameSuccess'));
    } catch (error) {
      alertApiV1Error(error, t('errors:renameWorkspace'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings:general.nameTitle')}
      description={t('settings:general.nameHelp')}
      footer={
        <Button type="button" variant="primary" onClick={save} disabled={saving || invalid || !changed}>
          {saving ? <Loading size="sm" /> : null}
          {t('common:save')}
        </Button>
      }
    >
      <WorkspaceNameField value={name} onChange={setDraft} />
    </SettingsSection>
  );
}
