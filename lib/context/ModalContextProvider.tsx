import { createContext, ReactNode } from 'react';

interface ModalContextProps {
  content: ReactNode[];
  hideCloseButton: boolean[];

  openModal: (content: ReactNode, hideCloseButton?: boolean) => void;

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
