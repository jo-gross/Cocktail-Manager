import React, { useContext, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { FaTrashAlt } from 'react-icons/fa';
import { FaCropSimple, FaImage } from 'react-icons/fa6';
import { Button } from '@components/ui';
import { UploadDropZone } from '@components/UploadDropZone';
import CropComponent from '@components/CropComponent';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { convertBase64ToFile, convertToBase64 } from '@lib/Base64Converter';
import { resizeImage } from '@lib/ImageCompressor';

export interface ImageValue {
  /** Cropped and resized image (base64), the value that is saved. */
  image: string;
  /** Source of the crop, kept to allow cropping again. */
  originalImage: File;
}

interface ImageEditorModalProps {
  title: string;
  value?: { image?: string; originalImage?: File };
  /** Crop aspect ratio (width / height). */
  aspect: number;
  /** Size of the stored image in px. */
  width: number;
  height: number;
  alt: string;
  /** Explains that saving crops the image permanently. */
  cropInfo?: string;
  /** `undefined` removes the image. */
  onChange: (value: ImageValue | undefined) => void;
}

/** Choose (file / camera / URL), crop and apply an image – or crop again / remove the current one. */
export function ImageEditorModal({ title, value, aspect, width, height, alt, cropInfo, onChange }: ImageEditorModalProps) {
  const { t } = useTranslation(['common']);
  const modalContext = useContext(ModalContext);
  const hasImage = value?.image != undefined;
  const [mode, setMode] = useState<'overview' | 'upload' | 'crop'>(hasImage ? 'overview' : 'upload');
  const [file, setFile] = useState<File | undefined>(undefined);

  const startCrop = (source: File) => {
    setFile(source);
    setMode('crop');
  };

  return (
    <div className="flex w-[min(36rem,calc(100vw-3rem))] flex-col gap-4">
      <h2 className="pr-10 text-2xl font-bold">{title}</h2>

      {mode === 'overview' && value?.image != undefined && (
        <div className="flex flex-col items-center gap-4">
          <div
            className="bg-transparent-pattern relative overflow-hidden rounded-xl border border-base-300"
            style={{ aspectRatio: `${aspect}`, width: aspect >= 1 ? '14rem' : '10rem' }}
          >
            <Image src={value.image} alt={alt} fill unoptimized className="object-contain" />
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" onClick={() => setMode('upload')}>
              <FaImage aria-hidden />
              {t('common:form.chooseNewImage')}
            </Button>
            <Button type="button" variant="outline" onClick={() => startCrop(value.originalImage ?? convertBase64ToFile(value.image!))}>
              <FaCropSimple aria-hidden />
              {t('common:form.recrop')}
            </Button>
            <Button
              type="button"
              variant="outline-error"
              onClick={() => {
                onChange(undefined);
                modalContext.closeModal();
              }}
            >
              <FaTrashAlt aria-hidden />
              {t('common:form.removeImage')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <UploadDropZone
          onSelectedFilesChanged={(selected) => {
            if (selected == undefined) {
              alertService.error(t('common:fileSelectError'));
              return;
            }
            startCrop(selected);
          }}
        />
      )}

      {mode === 'crop' && file != undefined && (
        <div className="flex flex-col gap-2">
          <CropComponent
            isValid
            aspect={aspect}
            imageToCrop={file}
            onCroppedImageComplete={(cropped) => {
              resizeImage(cropped, width, height, async (compressed) => {
                if (!compressed) {
                  alertService.error(t('common:imageScaleError'));
                  return;
                }
                onChange({ image: await convertToBase64(new File([compressed], 'image.png', { type: 'image/png' })), originalImage: file });
                modalContext.closeModal();
              });
            }}
            onCropCancel={() => setMode(hasImage ? 'overview' : 'upload')}
          />
          {cropInfo ? <p className="text-xs text-base-content/60">{cropInfo}</p> : null}
        </div>
      )}
    </div>
  );
}
