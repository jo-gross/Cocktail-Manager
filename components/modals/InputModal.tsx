import { ModalContext } from '@lib/context/ModalContextProvider';
import React, { useContext, useState } from 'react';
import { Button, ButtonGroup, Input, Loading } from '@components/ui';

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
      <ButtonGroup className="w-full">
        <Input joinItem value={inputValue} autoFocus={true} className="w-full" onChange={(event) => setInputValue(event.target.value)} />
        <Button
          joinItem
          variant="primary"
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
          {isSubmitting ? <Loading size="sm" /> : null}
          Speichern
        </Button>
      </ButtonGroup>
    </div>
  );
}
