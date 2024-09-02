import ReactCrop, { Crop } from 'react-image-crop';
import { useRef, useState } from 'react';
import 'react-image-crop/dist/ReactCrop.css';
import { FaTrashAlt } from 'react-icons/fa'; // Vergiss nicht, die Styles von ReactCrop zu importieren!

interface CropComponentProps {
  imageToCrop: File;
  onCroppedImageComplete: (image: File) => void;
  onCropCancel?: () => void;
  aspect?: number;
}

export default function CropComponent(props: CropComponentProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });
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
      }, 'image/jpeg');
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2">
      <ReactCrop
        crop={crop}
        onChange={(newCrop) => setCrop(newCrop)}
        aspect={props.aspect}
        className="h-auto w-full" // Ensures the image takes the full width of its container and maintains aspect ratio
      >
        <img
          src={URL.createObjectURL(props.imageToCrop)}
          ref={imgRef}
          alt="Crop"
          className="max-h-96 w-full object-contain" // Ensures the image fits within the container without overflowing
        />
      </ReactCrop>
      <div className={'flex w-full flex-row items-center justify-end gap-2'}>
        <button disabled={!crop || crop?.width === 0 || crop?.height === 0} type="button" onClick={createCropPreview} className="btn btn-primary flex-1">
          Zuschneiden und Bild übernehmen
        </button>
        {props.onCropCancel && (
          <button className={'btn btn-square btn-outline btn-error'} onClick={props.onCropCancel}>
            <FaTrashAlt />
          </button>
        )}
      </div>
    </div>
  );
}
