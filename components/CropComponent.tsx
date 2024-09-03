import ReactCrop, { Crop } from 'react-image-crop';
import { useRef, useState } from 'react';
import 'react-image-crop/dist/ReactCrop.css';
import { FaTrashAlt } from 'react-icons/fa';

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
  const containerRef = useRef<HTMLDivElement>(null);

  const generateCroppedImage = async () => {
    if (!crop || !imgRef.current || !containerRef.current) return;

    const scaleX = imgRef.current!.naturalWidth / imgRef.current!.width;
    const scaleY = imgRef.current!.naturalHeight / imgRef.current!.height;

    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    // Berechne den Offset des Bildes im Container
    const containerRect = containerRef.current!.getBoundingClientRect();
    const imgRect = imgRef.current!.getBoundingClientRect();
    const offsetX = (containerRect.width - imgRect.width) / 2;
    const offsetY = (containerRect.height - imgRect.height) / 2;

    // Erstelle ein Canvas mit den Dimensionen des Crop-Bereichs
    const canvas = document.createElement('canvas');
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    // Setze den Hintergrund auf Weiß
    ctx!.fillStyle = 'white';
    ctx!.fillRect(0, 0, canvas.width, canvas.height);

    // Zeichne das Bild auf das Canvas, nur der gecroppte Bereich wird sichtbar sein
    ctx?.drawImage(imgRef.current!, (crop.x - offsetX) * scaleX, (crop.y - offsetY) * scaleY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

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
      <ReactCrop crop={crop} onChange={(newCrop) => setCrop(newCrop)} aspect={props.aspect} className="h-auto w-fit">
        <div className={'relative h-96 max-h-96 w-96 max-w-96'} ref={containerRef} id={'image-container-ref'}>
          <div className={'absolute h-full w-full bg-red-500'}></div>
          <img
            ref={imgRef}
            src={URL.createObjectURL(props.imageToCrop)}
            alt="Crop"
            className="absolute bottom-0 left-0 right-0 top-0 m-auto max-h-96 max-w-96 object-contain"
          />
        </div>
      </ReactCrop>
      <div className="flex w-full flex-row items-center justify-end gap-2">
        <button disabled={!crop || crop?.width === 0 || crop?.height === 0} type="button" onClick={generateCroppedImage} className="btn btn-primary flex-1">
          Zuschneiden und Bild übernehmen
        </button>
        {props.onCropCancel && (
          <button className="btn btn-square btn-outline btn-error" onClick={props.onCropCancel}>
            <FaTrashAlt />
          </button>
        )}
      </div>
    </div>
  );
}
