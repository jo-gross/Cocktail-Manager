import Image from 'next/image';
import React from 'react';

interface AvatarImageProps {
  src: string;
  alt: string;
}

export default function AvatarImage(props: AvatarImageProps) {
  return (
    <div className="w-full h-full relative mask mask-squircle">
      <div className={'w-full h-full absolute z-1000'}>
        <Image
          className={'w-full h-full object-cover blur-sm'}
          src={props.src}
          alt={props.alt}
          width={300}
          height={300}
        />
      </div>
      <div className={'h-full w-full absolute z-100'}>
        <Image className={'w-min h-full object-contain'} src={props.src} alt={props.alt} width={300} height={300} />
      </div>
    </div>
  );
}
