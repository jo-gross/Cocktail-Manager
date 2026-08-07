import Image from 'next/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ImageModalProps {
  image: string;
}

export default function ImageModal(props: ImageModalProps) {
  const { t } = useTranslation('cocktail');
  return (
    <div className={'flex h-[60vh] w-full items-center justify-center'}>
      <Image src={props.image} className={'h-full w-full rounded-xl object-contain'} alt={t('cocktailImageAlt')} width={400} height={400} unoptimized={true} />
    </div>
  );
}
