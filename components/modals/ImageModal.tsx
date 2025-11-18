import Image from 'next/image';
import React from 'react';

interface ImageModalProps {
  image: string;
}

export default function ImageModal(props: ImageModalProps) {
  return (
    <div className={'flex h-[60vh] w-full items-center justify-center'}>
      <Image src={props.image} className={'h-full w-full rounded-xl object-contain'} alt={'Cocktail-Bild'} width={400} height={400} unoptimized={true} />
    </div>
  );
}
