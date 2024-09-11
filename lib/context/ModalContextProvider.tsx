import { createContext } from 'react';

interface ModalContextProps {
  content: JSX.Element[];
  hideCloseButton: boolean[];

  openModal: (content: JSX.Element, hideCloseButton?: boolean) => void;

  closeModal(): void;

  closeAllModals(): void;
}

export const ModalContext = createContext<ModalContextProps>({
  hideCloseButton: [],
  content: [],
  openModal: () => {},
  closeModal: () => {},
  closeAllModals: () => {},
});
