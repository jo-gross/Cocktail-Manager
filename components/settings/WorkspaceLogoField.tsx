import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CropComponent from '@components/CropComponent';
import { UploadDropZone } from '@components/UploadDropZone';
import { WorkspaceLogo } from '@components/workspaces/WorkspaceLogo';
import { Button } from '@components/ui';
import { resizeImage } from '@lib/ImageCompressor';
import { convertToBase64 } from '@lib/Base64Converter';
import { alertApiV1Error } from '@lib/network/apiV1';

export interface WorkspaceLogoFieldState {
  /** "Change" was clicked or an image is being cropped. */
  editing: boolean;
  /** An uploaded image waits for cropping. */
  cropping: boolean;
  /** The cropped image is being resized. */
  processing: boolean;
}

interface WorkspaceLogoFieldProps {
  /** Logo to show (data URI or URL); null/undefined = none. */
  image: string | null | undefined;
  name: string;
  /** Disables the buttons (e.g. while the parent saves). */
  disabled?: boolean;
  /** A new logo (data URI, 512×512) or `null` = removed. */
  onChange: (image: string | null) => void;
  onStateChange?: (state: WorkspaceLogoFieldState) => void;
}

/**
 * Logo preview, upload, square crop and remove; shared by the general settings and the setup wizard.
 * The parent decides when to save; remount it (`key`) to discard an unfinished upload.
 */
export function WorkspaceLogoField({ image, name, disabled = false, onChange, onStateChange }: WorkspaceLogoFieldProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [original, setOriginal] = useState<File>();
  const [changing, setChanging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = disabled || processing;

  useEffect(() => {
    onStateChange?.({ editing: changing || original !== undefined, cropping: original !== undefined, processing });
  }, [changing, original, processing, onStateChange]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-base-300 bg-base-100">
          {image ? (
            <WorkspaceLogo image={image} name={name} className="h-full w-full" />
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
                onChange(null);
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
            setProcessing(true);
            resizeImage(file, 512, 512, async (blob) => {
              try {
                if (!blob) throw new Error('Image resize failed');
                onChange(await convertToBase64(new File([blob], 'logo.png', { type: 'image/png' })));
                setOriginal(undefined);
                setChanging(false);
              } catch (error) {
                alertApiV1Error(error, t('common:imageScaleError'));
              } finally {
                setProcessing(false);
              }
            });
          }}
        />
      ) : !busy && (changing || !image) ? (
        <UploadDropZone label={t('settings:logo.upload')} onSelectedFilesChanged={setOriginal} />
      ) : null}
    </>
  );
}
