import React, { useContext } from 'react';
import Image from 'next/image';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { FaCamera, FaPen } from 'react-icons/fa';
import { cn } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { ImageEditorModal } from './ImageEditorModal';

interface ImageFormValues {
  image: string | undefined;
  originalImage?: File | undefined;
}

interface FormikImageTileProps {
  /** Crop aspect ratio (width / height). */
  aspect: number;
  /** Size of the stored image in px. */
  width: number;
  height: number;
  alt: string;
  cropInfo?: string;
  /** `fill` stretches the tile to its container width (e.g. inside a preview card). */
  size?: 'md' | 'fill';
  className?: string;
}

/**
 * The image of an entity form (Formik fields `image` + `originalImage`) as one tap target: shows the
 * image or an "add image" placeholder and opens the {@link ImageEditorModal} (upload, crop, remove).
 */
export function FormikImageTile({ aspect, width, height, alt, cropInfo, size = 'md', className }: FormikImageTileProps) {
  const { t } = useTranslation(['common']);
  const { values, setFieldValue } = useFormikContext<ImageFormValues>();
  const modalContext = useContext(ModalContext);
  const hasImage = values.image != undefined;

  const openEditor = () =>
    modalContext.openModal(
      <ImageEditorModal
        title={hasImage ? t('common:form.editImage') : t('common:form.addImage')}
        value={{ image: values.image, originalImage: values.originalImage }}
        aspect={aspect}
        width={width}
        height={height}
        alt={alt}
        cropInfo={cropInfo}
        onChange={async (next) => {
          await setFieldValue('image', next?.image);
          await setFieldValue('originalImage', next?.originalImage);
        }}
      />,
    );

  return (
    <button
      type="button"
      onClick={openEditor}
      aria-label={hasImage ? t('common:form.editImage') : t('common:form.addImage')}
      className={cn(
        'group relative shrink-0 cursor-pointer overflow-hidden rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        hasImage
          ? 'bg-transparent-pattern border border-base-300'
          : 'border-2 border-dashed border-base-300 bg-base-100 hover:border-primary/60 hover:bg-base-200',
        size === 'fill' ? 'w-full' : aspect >= 1 ? 'w-32' : 'w-28',
        className,
      )}
      style={{ aspectRatio: `${aspect}` }}
    >
      {hasImage ? (
        <>
          <Image src={values.image ?? ''} alt={alt} fill unoptimized className="object-contain" />
          <span className="absolute right-1.5 bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-base-100/90 text-xs text-base-content shadow">
            <FaPen aria-hidden />
          </span>
        </>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-base-content/60 group-hover:text-base-content">
          <FaCamera aria-hidden className="text-lg" />
          {t('common:form.addImage')}
        </span>
      )}
    </button>
  );
}
