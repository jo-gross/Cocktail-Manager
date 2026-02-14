import { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';

interface ConfirmActionModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'error';
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
}

export function ConfirmActionModal({ title, message, confirmLabel, confirmVariant = 'primary', onConfirm, onCancel }: ConfirmActionModalProps) {
  const modalContext = useContext(ModalContext);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold">{title}</div>
      <div className="max-w-xl text-justify">{message}</div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={loading}
          className="btn btn-outline"
          onClick={() => {
            onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          disabled={loading}
          className={confirmVariant === 'error' ? 'btn btn-error' : 'btn btn-primary'}
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm();
              modalContext.closeModal();
            } catch (error) {
              console.error('ConfirmActionModal onConfirm', error);
              alertService.error('Aktion fehlgeschlagen');
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : null}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
