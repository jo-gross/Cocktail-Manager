import { useEffect, useState } from 'react';

interface ImportPhotoByUrlProps {
  onImport: (imageUrl: string) => Promise<void>;
}

export default function ImportPhotoByUrl({ onImport }: ImportPhotoByUrlProps) {
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

  const handleImport = async () => {
    if (isDisabled || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      await onImport(imageUrl);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <input
        type="text"
        placeholder="Bild-URL eingeben..."
        className="input input-bordered mb-2 w-full"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isDisabled && !isLoading) {
            e.preventDefault();
            handleImport();
          }
        }}
      />
      <button className="btn btn-secondary w-full" type={'button'} disabled={isDisabled || isLoading} onClick={handleImport}>
        {isLoading ? <span className="loading-spinner-small loading"></span> : <></>}
        Bild herunterladen
      </button>
    </>
  );
}
