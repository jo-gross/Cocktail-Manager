import { useEffect, useState } from 'react';

interface ImportPhotoByUrlModalProps {
  onImport: (imageUrl: string) => Promise<void>;
  hideTitle?: boolean;
}

export default function ImportPhotoByUrlModal({ onImport, hideTitle }: ImportPhotoByUrlModalProps) {
  const [imageUrl, setImageUrl] = useState<string>('');

  const [isDisabled, setIsDisabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      const url = new URL(imageUrl);
      setIsDisabled(false);
    } catch (error) {
      setIsDisabled(true);
    }
  }, [imageUrl]);

  return (
    <>
      {!(hideTitle == true) && <h2 className={'p-2 text-2xl font-bold'}>Bild über URL laden</h2>}
      <input type="text" placeholder="Bild-URL eingeben..." className="input mb-2 w-full" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      <button
        className="btn btn-secondary w-full"
        type={'button'}
        disabled={isDisabled || isLoading}
        onClick={async () => {
          setIsLoading(true);
          try {
            await onImport(imageUrl);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        {isLoading ? <span className="loading-spinner-small loading"></span> : <></>}
        Bild herunterladen
      </button>
    </>
  );
}
