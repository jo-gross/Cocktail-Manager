import React, { useContext, useEffect } from 'react';
import { Button, Modal, ModalBackdrop, ModalBox } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import { AlertsContainer } from '../layout/AlertBoundary/AlertsContainer';

interface GlobalModalProps {
  children: React.ReactNode;
}

export function GlobalModal(props: GlobalModalProps) {
  const modalContext = useContext(ModalContext);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.keyCode === 27) {
        modalContext.closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [modalContext]);

  const activeModalIndex = modalContext.content.length - 1;
  const hideCloseButton = modalContext.hideCloseButton[activeModalIndex] ?? false;

  return (
    <div>
      <div className={modalContext.content.length >= 1 ? 'print:hidden' : ''}>{props.children}</div>
      <Modal id="globalModal">
        <div className={'pointer-events-none fixed bottom-2 left-1/2 z-50 w-full max-w-fit -translate-x-1/2 overflow-hidden print:hidden'}>
          <AlertsContainer />
        </div>
        <ModalBox className="relative z-10 p-2 md:p-4 print:top-0 print:shadow-none">
          {!hideCloseButton && (
            <form method="dialog" className={'print:hidden'}>
              {modalContext.content.length > 1 && (
                <Button type="button" variant="outline" shape="circle" size="sm" onClick={() => modalContext.closeModal()} className="absolute top-2 left-2">
                  <FaArrowLeft />
                </Button>
              )}
              <Button type="button" variant="outline" shape="circle" size="sm" onClick={() => modalContext.closeAllModals()} className="absolute top-2 right-2">
                <FaTimes />
              </Button>
            </form>
          )}
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
        </ModalBox>
        <ModalBackdrop>
          <button
            type="button"
            aria-label="Close modal"
            className="fixed inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
            onClick={() => modalContext.closeModal()}
          >
            <span className="sr-only">close</span>
          </button>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
