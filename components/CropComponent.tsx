import ReactCrop, { Crop } from 'react-image-crop';
import { useRef, useState } from 'react';

interface CropComponentProps {
  imageToCrop: File;
  onCroppedImageComplete: (image: File) => void;
  aspect?: number;
}

export default function CropComponent(props: CropComponentProps) {
  const [imageToCrop, setImageToCrop] = useState<File | undefined>(undefined);
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const createCropPreview = async () => {
    if (!crop || !imgRef.current) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current!.naturalWidth / imgRef.current!.width;
    const scaleY = imgRef.current!.naturalHeight / imgRef.current!.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    ctx?.drawImage(imgRef.current!, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width, crop.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        props.onCroppedImageComplete(new File([blob], 'image.jpeg', { type: 'image/jpeg' }));

        // const img = new Image();
        // img.src = window.URL.createObjectURL(blob);
      }, 'image/jpeg');
    });
  };

  return (
    <div>
      <ReactCrop crop={crop} onChange={(c) => setCrop(c)} className={'h-full'} aspect={props.aspect}>
        <img className={'h-96'} ref={imgRef} src={URL.createObjectURL(props.imageToCrop)} />
      </ReactCrop>
      <button
        disabled={!crop || crop?.width === 0 || crop?.height === 0}
        type={'button'}
        onClick={() => {
          createCropPreview();
          setImageToCrop(undefined);
        }}
        className="btn btn-primary mt-2"
      >
        Zuschneiden und Bild übernehmen
      </button>
    </div>
  );
}
