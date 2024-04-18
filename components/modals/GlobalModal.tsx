import React, { useContext, useEffect } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { FaTimes } from 'react-icons/fa';

interface GlobalModalProps {
  children: React.ReactNode;
}

export function GlobalModal(props: GlobalModalProps) {
  const modalContext = useContext(ModalContext);

  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.keyCode === 27) {
        modalContext.closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [modalContext]);

  return (
    <div>
      {props.children}
      <input type="checkbox" id="globalModal" className="modal-toggle" />
      <label htmlFor="globalModal" className="modal cursor-pointer">
        <label className={`modal-box relative w-full p-1.5 md:max-w-2xl md:p-4`} htmlFor="">
          <label htmlFor="globalModal" className="btn btn-circle btn-outline btn-sm absolute right-2 top-2">
            <FaTimes />
          </label>
          <label className={''} htmlFor="">
            {modalContext.content}
          </label>
        </label>
      </label>
    </div>
  );
}
