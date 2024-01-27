import { useState } from 'react';
import Image from 'next/image';

interface NextImageProps {
  src: string;
  alt: string;
  className?: string;
  altComponent?: React.ReactNode;
  width?: number;
  height?: number;
}

export default function NextImage(props: NextImageProps) {
  const [error, setError] = useState(false);

  return error ? (
    props.altComponent
  ) : (
    <Image className={props.className} src={props.src} alt={props.alt} onError={() => setError(true)} width={props.width} height={props.height} />
  );
}
