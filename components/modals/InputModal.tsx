import { ModalContext } from '@lib/context/ModalContextProvider';
import React, { useContext, useState } from 'react';

interface InputModalProps {
  title: string;
  description?: string;
  defaultValue?: string;
  onInputSubmit: (value: string) => Promise<void>;
  allowEmpty?: boolean;
}

export default function InputModal(props: InputModalProps) {
  const modalContext = useContext(ModalContext);

  const [inputValue, setInputValue] = useState(props.defaultValue || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className={'flex w-full flex-col space-y-2'}>
      <div className={'text-2xl font-bold'}>{props.title}</div>
      <div>{props.description}</div>
      <div className={'join'}>
        <input
          value={inputValue}
          autoFocus={true}
          className={'input join-item input-bordered w-full'}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button
          className={'btn btn-primary join-item'}
          disabled={isSubmitting || (!props.allowEmpty && inputValue.trim().length == 0)}
          onClick={async () => {
            try {
              if (props.allowEmpty || inputValue.trim().length > 0) {
                setIsSubmitting(true);
                await props.onInputSubmit(inputValue);
                modalContext.closeModal();
              }
            } catch (error) {
              console.error('InputModal -> onInputSubmit', error);
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
          Speichern
        </button>
      </div>
    </div>
  );
}
