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
      console.error('Failed to read file.');
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to create canvas context.');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          callback(blob);
        },
        file.type,
        0.9,
      );
    };

    img.onerror = () => {
      console.error('Failed to load image.');
    };

    img.src = event.target.result as string;
  };

  reader.onerror = () => {
    console.error('Failed to read file with FileReader.');
  };

  reader.readAsDataURL(file);
}
