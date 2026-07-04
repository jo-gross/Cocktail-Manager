import { useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { FaCamera, FaFileAlt, FaLink } from 'react-icons/fa';
import ImportPhotoByUrl from './ImportPhotoByUrl';
import { alertService } from '@lib/alertService';
import { Button, Divider } from '@components/ui';

interface UploadDropZoneProps {
  onSelectedFilesChanged: (file: File | undefined) => void;
  onFilesSelected?: (files: File[]) => void;
  maxUploadSize?: string;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
}

export function UploadDropZone(props: UploadDropZoneProps) {
  const identifier = Math.floor(Math.random() * 1000000);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accept = props.accept ?? 'image/*';
  const label = props.label ?? 'Bild wählen';
  const hint = props.hint ?? '(z.B. SVG, PNG, JPG oder GIF)';

  const handleFiles = (fileList: FileList | null | undefined) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    if (props.multiple) {
      props.onFilesSelected?.(Array.from(fileList));
      return;
    }

    props.onSelectedFilesChanged(fileList[0]);
  };

  const handleUrlImport = async (imageUrl: string) => {
    try {
      const response = await fetch(`/api/scraper/image?url=${encodeURIComponent(imageUrl)}`);

      if (!response.ok) {
        alertService.error('Fehler beim Laden des Bildes');
        console.log('Fehler beim Laden des Bildes:', response);
      } else {
        const blob = await response.blob();
        const file = new File([blob], 'imported-image.jpg', { type: blob.type });

        props.onSelectedFilesChanged(file);
        setShowUrlInput(false);
      }
    } catch (error) {
      console.error('Fehler beim Laden des Bildes:', error);
      alertService.error('Fehler beim Laden des Bildes');
    }
  };

  return (
    <>
      <div className="flex h-fit w-full items-center justify-center">
        {isMobile ? (
          <>
            {!showUrlInput ? (
              <div className="grid w-full grid-cols-3 gap-2">
                <Button variant="outline" type="button" onClick={() => cameraInputRef.current?.click()}>
                  <FaCamera /> Kamera
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  name="file"
                  className="hidden"
                  capture="environment"
                  accept={accept}
                  onChange={(event) => {
                    handleFiles(event?.target?.files);
                  }}
                />
                <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                  <FaFileAlt /> Datei
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  className="hidden"
                  accept={accept}
                  multiple={props.multiple}
                  onChange={(event) => {
                    handleFiles(event?.target?.files);
                  }}
                />
                <Button variant="outline" type="button" onClick={() => setShowUrlInput(true)}>
                  <FaLink /> URL
                </Button>
              </div>
            ) : (
              <div className="w-full">
                <ImportPhotoByUrl onImport={handleUrlImport} />
                <Button variant="outline" size="sm" type="button" className="mt-2 w-full p-1" onClick={() => setShowUrlInput(false)}>
                  Zurück
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full">
            <label
              htmlFor={'dropzone-file-' + identifier}
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200 hover:border-base-300 hover:bg-base-100 dark:bg-base-200 dark:hover:bg-base-100"
            >
              <div className="text-2xl font-bold">{label}</div>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  aria-hidden="true"
                  className="mb-3 h-10 w-10 text-base-content"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  ></path>
                </svg>
                <p className="mb-2 text-sm text-base-content">
                  <span className="font-semibold">Klicken, zum auswählen</span> oder ziehen
                </p>
                <p className="text-xs text-base-content">{hint}</p>
                {props.maxUploadSize && (
                  <p className="text-xs text-base-content">
                    Maximale Datei-Größe: <strong>{props.maxUploadSize}</strong>
                  </p>
                )}
              </div>
              <input
                id={'dropzone-file-' + identifier}
                type="file"
                name={`file-${identifier}`}
                className="hidden"
                accept={accept}
                multiple={props.multiple}
                onChange={(event) => {
                  handleFiles(event?.target?.files);
                }}
              />
            </label>
            {!props.multiple ? (
              <>
                <Divider className="my-4 flex items-center gap-4 before:content-none after:content-none">
                  <span className="h-px flex-1 bg-base-content/15" />
                  <span className="text-sm text-base-content/70">Bild über URL laden</span>
                  <span className="h-px flex-1 bg-base-content/15" />
                </Divider>
                <ImportPhotoByUrl onImport={handleUrlImport} />
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
