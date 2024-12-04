import React, { useContext, useEffect } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import { AlertsContainer } from '../layout/AlertBoundary/AlertsContainer';

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
        <div className="fixed left-2 top-2 z-50 ml-2 flex flex-col items-center justify-center overflow-hidden md:left-10 md:top-10 print:hidden">
          <AlertsContainer />
        </div>
        <div className={`modal-box relative w-fit min-w-[30%] p-1.5 md:p-4`}>
          <form method="dialog">
            {modalContext.content.length > 1 && (
              <div
                onClick={() => modalContext.closeModal()}
                className={`btn btn-circle btn-outline btn-sm absolute left-2 top-2 ${modalContext.hideCloseButton[modalContext.hideCloseButton.length - 1] ? 'hidden' : ''}`}
              >
                <FaArrowLeft />
              </div>
            )}
            <div
              onClick={() => modalContext.closeAllModals()}
              className={`btn btn-circle btn-outline btn-sm absolute right-2 top-2 ${modalContext.hideCloseButton[modalContext.hideCloseButton.length - 1] ? 'hidden' : ''}`}
            >
              <FaTimes />
            </div>
          </form>
          {modalContext.content.map((content, index) => (
            <div
              key={index}
              className={
                index == modalContext.content.length - 1
                  ? modalContext.content.length > 1 && !(modalContext.hideCloseButton[index] ?? false)
                    ? 'pt-6'
                    : ''
                  : 'hidden'
              }
            >
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
