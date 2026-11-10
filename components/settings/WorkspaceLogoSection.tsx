import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CropComponent from '@components/CropComponent';
import { UploadDropZone } from '@components/UploadDropZone';
import { WorkspaceLogo } from '@components/workspaces/WorkspaceLogo';
import { Button, Loading } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { convertToBase64 } from '@lib/Base64Converter';
import { updateWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { alertService } from '@lib/alertService';
import { SettingsSection } from './SettingsSection';

export function WorkspaceLogoSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const { workspace, refreshWorkspace } = useContext(UserContext);
  const [draft, setDraft] = useState<string | null | undefined>();
  const [original, setOriginal] = useState<File>();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const image = draft === undefined ? workspace?.image : draft;

  const reset = () => {
    setDraft(undefined);
    setOriginal(undefined);
    setChanging(false);
  };

  const save = async () => {
    if (draft === undefined || busy) return;
    setBusy(true);
    try {
      await updateWorkspace(workspaceId, { image: draft });
      await refreshWorkspace();
      reset();
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setBusy(false);
    }
  };

  const hasFooter = draft !== undefined || changing || original;

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
            {draft !== undefined && !original ? (
              <Button type="button" variant="primary" disabled={busy} onClick={save}>
                {t('common:save')}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-base-300 bg-base-100">
          {image ? (
            <WorkspaceLogo image={image} name={workspace?.name ?? ''} className="h-full w-full" />
          ) : (
            <span className="px-2 text-center text-xs text-base-content/60">{t('settings:logo.empty')}</span>
          )}
        </div>
        {image && !original && !changing ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setChanging(true)}>
              {t('settings:logo.change')}
            </Button>
            <Button
              type="button"
              variant="outline-error"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setChanging(false);
              }}
            >
              {t('settings:logo.remove')}
            </Button>
          </div>
        ) : null}
      </div>
      {!busy && original ? (
        <CropComponent
          imageToCrop={original}
          aspect={1}
          isValid
          onCropCancel={() => setOriginal(undefined)}
          onCroppedImageComplete={(file) => {
            setBusy(true);
            resizeImage(file, 512, 512, async (blob) => {
              try {
                if (!blob) throw new Error('Image resize failed');
                setDraft(await convertToBase64(new File([blob], 'logo.png', { type: 'image/png' })));
                setOriginal(undefined);
                setChanging(false);
              } catch (error) {
                alertApiV1Error(error, t('common:imageScaleError'));
              } finally {
                setBusy(false);
              }
            });
          }}
        />
      ) : !busy && (changing || !image) ? (
        <UploadDropZone label={t('settings:logo.upload')} onSelectedFilesChanged={setOriginal} />
      ) : null}
    </SettingsSection>
  );
}
