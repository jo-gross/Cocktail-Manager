import React, { useContext, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Input, Loading } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { UserContext } from '@lib/context/UserContextProvider';
import { updateWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { alertService } from '@lib/alertService';
import { SettingsSection } from './SettingsSection';

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 50;

export function WorkspaceNameSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors', 'entity']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const currentName = workspace?.name ?? '';
  // null = untouched, i.e. follow the current workspace name.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = draft ?? currentName;

  const trimmed = name.trim();
  const invalid = trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH;
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
      <FormField label={t('common:name')} htmlFor="workspace-name" required error={invalid ? t('settings:general.nameInvalid') : undefined}>
        <Input id="workspace-name" value={name} maxLength={NAME_MAX_LENGTH} error={invalid} onChange={(event) => setDraft(event.target.value)} />
      </FormField>
    </SettingsSection>
  );
}
