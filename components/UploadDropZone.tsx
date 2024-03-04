import { isMobile } from 'react-device-detect';
import { FaCamera, FaFileAlt } from 'react-icons/fa';

interface UploadDropZoneProps {
  onSelectedFilesChanged: (file: File | undefined) => void;
  maxUploadSize?: string;
}

export function UploadDropZone(props: UploadDropZoneProps) {
  const identifier = Math.floor(Math.random() * 1000000);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {isMobile ? (
        <>
          <div className={'grid grid-cols-2 gap-2'}>
            <label className={'btn btn-outline'}>
              <FaCamera />
              Kamera
              <input
                type="file"
                name="file"
                className="hidden"
                capture="environment"
                accept={'image/*'}
                onChange={(event) => {
                  const file = event?.target?.files;
                  if (file) {
                    if (file.length > 0) {
                      props.onSelectedFilesChanged(file[0]);
                    } else {
                      props.onSelectedFilesChanged(undefined);
                    }
                  } else {
                    props.onSelectedFilesChanged(undefined);
                  }
                }}
              />
            </label>
            <label className={'btn btn-outline'}>
              <FaFileAlt />
              Datei
              <input
                type="file"
                name="file"
                className="hidden"
                accept={'image/*'}
                onChange={(event) => {
                  const file = event?.target?.files;
                  if (file) {
                    if (file.length > 0) {
                      props.onSelectedFilesChanged(file[0]);
                    } else {
                      props.onSelectedFilesChanged(undefined);
                    }
                  } else {
                    props.onSelectedFilesChanged(undefined);
                  }
                }}
              />
            </label>
          </div>
        </>
      ) : (
        <label
          htmlFor={'dropzone-file-' + identifier}
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-base-300 bg-base-200 hover:border-base-300 hover:bg-base-100 dark:bg-base-200 dark:hover:bg-base-100"
        >
          <div className="font-bo text-2xl">Bild wählen</div>
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
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

            <p className="text-xs text-base-content">(z.B. SVG, PNG, JPG or GIF)</p>
            {props.maxUploadSize ? (
              <p className="text-xs text-base-content">
                Maximale Datei-Größe: <strong>{props.maxUploadSize}</strong>
              </p>
            ) : (
              <></>
            )}
          </div>
          <input
            id={'dropzone-file-' + identifier}
            type="file"
            name={`file-${identifier}`}
            className="hidden"
            capture="environment"
            accept={'image/*'}
            onChange={(event) => {
              const file = event?.target?.files;
              if (file) {
                if (file.length > 0) {
                  props.onSelectedFilesChanged(file[0]);
                } else {
                  props.onSelectedFilesChanged(undefined);
                }
              } else {
                props.onSelectedFilesChanged(undefined);
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
