import { AppProps } from 'next/app';
import '../styles/global.css';
import { useCallback, useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { AlertBoundary } from '../components/layout/AlertBoundary';
import { SessionProvider } from 'next-auth/react';
import { User } from '@prisma/client';
import { AuthBoundary } from '../components/layout/AuthBoundary';
import { GlobalModal } from '../components/modals/GlobalModal';

const App = ({ Component, pageProps: { session, ...pageProps } }: AppProps) => {
  const [modalContent, setModalContent] = useState(<></>);

  return (
    <SessionProvider session={session}>
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
          <AuthBoundary>
            <GlobalModal>
              <Component {...pageProps} />
            </GlobalModal>
          </AuthBoundary>
        </ModalContext.Provider>
      </AlertBoundary>
    </SessionProvider>
  );
};

export default App;
