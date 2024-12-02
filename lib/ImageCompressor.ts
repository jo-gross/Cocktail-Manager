import imageCompression from 'browser-image-compression';

const defaultOptions = {
  maxSizeMB: 0.5,
};

export function compressFile(imageFile: File, options = defaultOptions) {
  return imageCompression(imageFile, options);
}

export function resizeImage(file: File, maxWidth: number, maxHeight: number, callback: (resizedBlob: Blob | null) => void): void {
  const reader = new FileReader();

  reader.onload = (event: ProgressEvent<FileReader>) => {
    if (!event.target?.result) {
      console.error('Fehler beim Lesen der Datei.');
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Berechne den Skalierungsfaktor
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // Canvas erstellen und das Bild skalieren
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Canvas-Kontext konnte nicht erstellt werden.');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Canvas in Blob konvertieren
      canvas.toBlob(
        (blob) => {
          callback(blob);
        },
        file.type,
        0.9, // Qualität (90%)
      );
    };

    img.onerror = () => {
      console.error('Fehler beim Laden des Bildes.');
    };

    img.src = event.target.result as string;
  };

  reader.onerror = () => {
    console.error('Fehler beim Lesen der Datei mit FileReader.');
  };

  reader.readAsDataURL(file);
}
