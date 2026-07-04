import { useEffect, useState } from 'react';
import { Button, Input, Loading } from '@components/ui';

interface ImportPhotoByUrlProps {
  onImport: (imageUrl: string) => Promise<void>;
}

export default function ImportPhotoByUrl({ onImport }: ImportPhotoByUrlProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isDisabled, setIsDisabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      const _url = new URL(imageUrl);
      setIsDisabled(false);
    } catch {
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
      <Input
        type="text"
        placeholder="Bild-URL eingeben..."
        className="mb-2 w-full"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isDisabled && !isLoading) {
            e.preventDefault();
            handleImport();
          }
        }}
      />
      <Button variant="secondary" className="w-full" type="button" disabled={isDisabled || isLoading} onClick={handleImport}>
        {isLoading ? <Loading size="sm" /> : null}
        Bild herunterladen
      </Button>
    </>
  );
}
