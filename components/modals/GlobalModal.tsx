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
      <dialog id="globalModal" className="modal">
        <div className={`modal-box relative w-full p-1.5 md:max-w-2xl md:p-4`}>
          <form method="dialog">
            <div onClick={() => modalContext.closeModal()} className="btn btn-circle btn-outline btn-sm absolute right-2 top-2">
              <FaTimes />
            </div>
          </form>
          {modalContext.content.map((content, index) => (
            <div key={index} className={index == modalContext.content.length - 1 ? '' : 'hidden'}>
              {content}
            </div>
          ))}
        </div>
        <form method="dialog" className="modal-backdrop">
          <div onClick={() => modalContext.closeModal()}>close</div>
        </form>
      </dialog>
    </div>
  );
}
