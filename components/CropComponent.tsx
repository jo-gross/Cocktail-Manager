import ReactCrop, { Crop } from 'react-image-crop';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'react-image-crop/dist/ReactCrop.css';
import { FaTrashAlt } from 'react-icons/fa';
import { Button, FormControl, Input, Label, Loading, Radio } from '@components/ui';

interface CropComponentProps {
  imageToCrop: File;
  onCroppedImageComplete: (image: File) => void;
  onCropCancel?: () => void;
  aspect?: number;
  isValid?: boolean;
}

export default function CropComponent(props: CropComponentProps) {
  const { t } = useTranslation('common');
  const [crop, setCrop] = useState<Crop | null>(null);

  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [customColor, setCustomColor] = useState<string>('#ffffff');

  const containerRef = useRef<HTMLDivElement>(null);

  const [imgRef, setImageRef] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!imgRef || !imageLoaded || !containerRef.current) return;
    const imgWidth = imgRef.naturalWidth;
    const imgHeight = imgRef.naturalHeight;

    if (imgWidth === 0 || imgHeight === 0) return;

    const containerWidthPx = containerRef.current.getBoundingClientRect().width;
    const containerHeightPx = containerRef.current.getBoundingClientRect().height;
    if (!props.aspect || props.aspect === 1) {
      setCrop({
        unit: 'px',
        width: containerWidthPx,
        height: containerHeightPx,
        x: 0,
        y: 0,
      });
    } else if (props.aspect > 1) {
      // e.g., 16/9
      const cropFactor = 1 / props.aspect;
      setCrop({
        unit: 'px',
        width: containerWidthPx,
        height: cropFactor * containerHeightPx,
        x: 0,
        y: (containerHeightPx - cropFactor * containerHeightPx) / 2,
      });
    } else {
      // e.g., 9/16
      const cropFactor = props.aspect;
      setCrop({
        unit: 'px',
        width: cropFactor * containerWidthPx,
        height: containerHeightPx,
        x: (containerWidthPx - cropFactor * containerWidthPx) / 2,
        y: 0,
      });
    }
  }, [imgRef, imageLoaded, props?.aspect]);

  const [isCropping, setIsCropping] = useState<boolean>(false);

  const generateCroppedImage = async () => {
    if (!crop || !imgRef || !containerRef.current) return;
    setIsCropping(true);
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;

    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    // Calculate image offset within the container
    const containerRect = containerRef.current!.getBoundingClientRect();
    const imgRect = imgRef.getBoundingClientRect();
    const offsetX = (containerRect.width - imgRect.width) / 2;
    const offsetY = (containerRect.height - imgRect.height) / 2;

    // Create a canvas with the crop area dimensions
    const canvas = document.createElement('canvas');
    // const canvas = new OffscreenCanvas(crop.width, crop.height);
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    // Fill background when a custom color is selected
    if (backgroundColor === 'custom') {
      ctx!.fillStyle = customColor;
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Draw the cropped image region onto the canvas
    ctx?.drawImage(imgRef, (crop.x - offsetX) * scaleX, (crop.y - offsetY) * scaleY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        // canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }

        setIsCropping(false);
        props.onCroppedImageComplete(new File([blob], 'image.png', { type: 'image/png' }));
      }, 'image/png');
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2">
      <div className={'flex h-full w-full flex-col gap-2 md:flex-row'}>
        <div className={`h-auto w-fit ${props.isValid == true ? '' : 'rounded-2xl border-2 border-error p-2 pb-1'}`}>
          <ReactCrop
            crop={crop || { width: 0, height: 0, unit: '%', x: 0, y: 0 }}
            onChange={(newCrop) => setCrop(newCrop)}
            aspect={props.aspect}
            className={`h-auto w-fit`}
          >
            <div className={`relative h-96 max-h-96 w-96 max-w-96`} ref={containerRef} id={'image-container-ref'}>
              {/*<div className={'bg-transparent-pattern absolute h-full w-full'}></div>*/}
              <div
                className={`absolute h-full w-full ${backgroundColor === 'transparent' ? 'bg-transparent-pattern' : `bg-[${customColor.toLowerCase()}]`}`}
                style={{ backgroundColor: backgroundColor === 'custom' ? customColor : '' }}
              ></div>
              <img
                ref={(imgRef) => setImageRef(imgRef)}
                src={URL.createObjectURL(props.imageToCrop)}
                alt={t('cropAlt')}
                className={'absolute top-0 right-0 bottom-0 left-0 m-auto max-h-96 max-w-96 object-contain'}
                onLoad={() => {
                  setImageLoaded(true);
                }}
              />
            </div>
          </ReactCrop>
        </div>
        <div>
          <div className={'font-bold'}>{t('backgroundColor')}</div>
          <FormControl>
            <Label className="flex-row items-center justify-between">
              {t('transparent')}
              <Radio name="bg-color" value="transparent" checked={backgroundColor === 'transparent'} onChange={() => setBackgroundColor('transparent')} />
            </Label>
          </FormControl>
          <FormControl>
            <Label className="flex-row items-center justify-between">
              {t('customColor')}
              <Radio name="bg-color" value="custom" checked={backgroundColor === 'custom'} onChange={() => setBackgroundColor('custom')} />
            </Label>
            <Input
              className={backgroundColor === 'custom' ? 'w-full' : 'hidden w-full'}
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              disabled={backgroundColor !== 'custom'}
            />
          </FormControl>
        </div>
      </div>
      <div className="flex w-full flex-row items-center justify-end gap-2">
        <Button
          disabled={!crop || crop?.width === 0 || crop?.height === 0 || isCropping}
          type="button"
          variant="primary"
          className="flex-1"
          onClick={async () => await generateCroppedImage()}
        >
          {isCropping ? <Loading size="sm" /> : null}
          {t('cropAndApply')}
        </Button>
        {props.onCropCancel && (
          <Button type="button" variant="outline" shape="square" className="border-error text-error hover:bg-error/10" onClick={props.onCropCancel}>
            <FaTrashAlt />
          </Button>
        )}
      </div>
    </div>
  );
}
