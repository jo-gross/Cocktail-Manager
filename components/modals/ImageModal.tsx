import Image from 'next/image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImageCredit } from '../ImageCredit';

interface ImageModalProps {
  image: string;
  /** Attribution shown below the image. */
  credit?: string | null;
}

export default function ImageModal(props: ImageModalProps) {
  const { t } = useTranslation('cocktail');
  return (
    <div className={'flex w-full flex-col items-center'}>
      <div className={'flex h-[60vh] w-full items-center justify-center'}>
        <Image
          src={props.image}
          className={'h-full w-full rounded-xl object-contain'}
          alt={t('cocktailImageAlt')}
          width={400}
          height={400}
          unoptimized={true}
        />
      </div>
      <ImageCredit credit={props.credit} className={'self-stretch text-xs'} />
    </div>
  );
}
