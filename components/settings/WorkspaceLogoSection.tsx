import { useContext, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { Button, Loading } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { updateWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { alertService } from '@lib/alertService';
import { SettingsSection } from './SettingsSection';
import { WorkspaceLogoField, type WorkspaceLogoFieldState } from './WorkspaceLogoField';

const IDLE: WorkspaceLogoFieldState = { editing: false, cropping: false, processing: false };

export function WorkspaceLogoSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const [draft, setDraft] = useState<string | null | undefined>();
  const [field, setField] = useState<WorkspaceLogoFieldState>(IDLE);
  // Remounting the field discards an unfinished upload.
  const [fieldKey, setFieldKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const busy = saving || field.processing;
  const image = draft === undefined ? workspace?.image : draft;
  useReportUnsavedChanges(draft !== undefined || field.cropping);

  const reset = () => {
    setDraft(undefined);
    setField(IDLE);
    setFieldKey((key) => key + 1);
  };

  const save = async () => {
    if (draft === undefined || busy) return;
    setSaving(true);
    try {
      await updateWorkspace(workspaceId, { image: draft });
      await refreshWorkspace();
      reset();
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setSaving(false);
    }
  };

  const hasFooter = draft !== undefined || field.editing;

  return (
    <SettingsSection
      title={t('settings:logo.title')}
      description={t('settings:logo.help')}
      footer={
        hasFooter ? (
          <>
            {busy ? <Loading size="sm" /> : null}
            <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
              {t('common:cancel')}
            </Button>
            {draft !== undefined && !field.cropping ? (
              <Button type="button" variant="primary" disabled={busy} onClick={save}>
                {t('common:save')}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <WorkspaceLogoField key={fieldKey} image={image} name={workspace?.name ?? ''} disabled={saving} onChange={setDraft} onStateChange={setField} />
    </SettingsSection>
  );
}
