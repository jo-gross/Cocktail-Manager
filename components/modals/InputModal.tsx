import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useContext, useState } from 'react';

interface InputModalProps {
  title: string;
  description?: string;
  defaultValue?: string;
  onInputChange: (value: string) => void;
  allowEmpty?: boolean;
}

export default function InputModal(props: InputModalProps) {
  const modalContext = useContext(ModalContext);

  const [inputValue, setInputValue] = useState(props.defaultValue || '');

  return (
    <div className={'flex flex-col w-fit space-y-2'}>
      <div className={'font-bold text-2xl'}>{props.title}</div>
      <div>{props.description}</div>
      <div className={'input-group'}>
        <input
          value={inputValue}
          className={'input input-bordered w-full'}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button
          className={'btn btn-primary'}
          onClick={() => {
            if (props.allowEmpty || inputValue.trim().length > 0) {
              props.onInputChange(inputValue);
              modalContext.closeModal();
            }
          }}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
