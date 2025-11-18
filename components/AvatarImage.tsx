import Image from 'next/image';
import React from 'react';

interface AvatarImageProps {
  src: string;
  alt: string;
  altComponent?: React.ReactNode;
  onClick?: () => void;
}

export default function AvatarImage(props: AvatarImageProps) {
  const [error, setError] = React.useState(false);

  return error ? (
    props.altComponent
  ) : (
    <div className={`mask mask-squircle relative h-full w-full ${props.onClick ? 'cursor-pointer' : ''}`} onClick={props.onClick}>
      <div className={'z-1000 absolute h-full w-full'}>
        <Image
          onError={() => {
            setError(true);
          }}
          className={'h-full w-full object-cover blur-sm'}
          src={props.src}
          alt={props.alt}
          width={300}
          height={300}
          unoptimized={true}
        />
      </div>
      <div className={'z-100 absolute flex h-full w-full items-center justify-center'}>
        <Image
          className={'h-full w-min object-contain'}
          src={props.src}
          alt={props.alt}
          width={300}
          height={300}
          onError={() => {
            setError(true);
          }}
          unoptimized={true}
        />
      </div>
    </div>
  );
}
