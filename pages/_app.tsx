import { AppProps } from 'next/app';
import '../styles/global.css';
import { GlobalModal } from '../components/modals/GlobalModal';
import { useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { AlertBoundary } from '../components/layout/AlertBoundary';

const App = ({ Component, pageProps }: AppProps) => {
  const [modalContent, setModalContent] = useState(<></>);

  return (
    <AlertBoundary>
      <ModalContext.Provider
        value={{
          content: modalContent,
          openModal: (content) => {
            if ((document.getElementById('globalModal') as any)?.checked == false) {
              document.getElementById('globalModal')?.click();
            }
            setModalContent(content);
          },
          closeModal() {
            if ((document.getElementById('globalModal') as HTMLInputElement | null)?.checked == true) {
              document.getElementById('globalModal')?.click();
            }
            setModalContent(<></>);
          },
        }}
      >
        <GlobalModal>
          <Component {...pageProps} />
        </GlobalModal>
      </ModalContext.Provider>
    </AlertBoundary>
  );
};

export default App;
