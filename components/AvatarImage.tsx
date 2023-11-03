import Image from 'next/image';
import React from 'react';

interface AvatarImageProps {
  src: string;
  alt: string;
}

export default function AvatarImage(props: AvatarImageProps) {
  return (
    <div className="mask mask-squircle relative h-full w-full">
      <div className={'z-1000 absolute h-full w-full'}>
        <Image
          className={'h-full w-full object-cover blur-sm'}
          src={props.src}
          alt={props.alt}
          width={300}
          height={300}
        />
      </div>
      <div className={'z-100 absolute h-full w-full'}>
        <Image className={'h-full w-min object-contain'} src={props.src} alt={props.alt} width={300} height={300} />
      </div>
    </div>
  );
}
