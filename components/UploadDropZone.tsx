interface UploadDropZoneProps {
  onSelectedFilesChanged: (file: File | undefined) => void;
}

export function UploadDropZone(props: UploadDropZoneProps) {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <label
        htmlFor="dropzone-file"
        className="flex flex-col items-center justify-center w-full h-full border-2 border-base-300 border-dashed rounded-lg cursor-pointer bg-base-200 dark:hover:bg-base-100 dark:bg-base-200 hover:bg-base-100 hover:border-base-300"
      >
        <div className="text-2xl font-bo">Bild wählen</div>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            aria-hidden="true"
            className="w-10 h-10 mb-3 text-base-content"
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
        </div>
        <input
          id="dropzone-file"
          type="file"
          name="file"
          className="hidden"
          accept={"image/*"}
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
  );
}
