import { createContext } from 'react';

interface ModalContextProps {
  content: JSX.Element[];

  openModal: (content: JSX.Element) => void;

  closeModal(): void;

  closeAllModals(): void;
}

export const ModalContext = createContext<ModalContextProps>({
  content: [],
  openModal: () => {},
  closeModal: () => {},
  closeAllModals: () => {},
});
