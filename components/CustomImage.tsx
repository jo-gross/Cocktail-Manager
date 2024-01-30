import { useState } from 'react';

interface ImageProps {
  src: string;
  alt: string;
  className?: string;
  altComponent?: React.ReactNode;
  imageWrapper?: (children: React.ReactNode) => React.ReactNode;
}

export default function CustomImage(props: ImageProps) {
  const [error, setError] = useState(false);

  return error ? (
    props.altComponent
  ) : props.imageWrapper ? (
    props.imageWrapper(<img className={props.className} src={props.src} alt={props.alt} onError={() => setError(true)} />)
  ) : (
    <img className={props.className} src={props.src} alt={props.alt} onError={() => setError(true)} />
  );
}
