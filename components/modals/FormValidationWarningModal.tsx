import { useContext } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';

interface FormValidationWarningProps {
  warnings: string[];
  onContinue?: () => void;
  onCancel?: () => void;
}

export function FormValidationWarningModal(props: FormValidationWarningProps) {
  const modalContext = useContext(ModalContext);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">Warnung</div>
      <div className="max-w-xl text-justify">
        <div className="mb-2">Folgende Punkte sind noch nicht ausgefüllt:</div>
        <ul className="list-inside list-disc space-y-1">
          {props.warnings.map((warning, index) => (
            <li key={index} className="text-warning">
              {warning}
            </li>
          ))}
        </ul>
        <div className="mt-4">Möchtest du trotzdem speichern?</div>
      </div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <div
          className={`btn btn-outline`}
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </div>
        <button
          className={`btn btn-primary`}
          onClick={() => {
            props.onContinue?.();
            modalContext.closeModal();
          }}
        >
          Trotzdem speichern
        </button>
      </div>
    </div>
  );
}

