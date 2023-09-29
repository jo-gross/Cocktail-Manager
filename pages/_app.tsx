import { AppProps } from 'next/app';
import '../styles/global.css';
import { useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { AlertBoundary } from '../components/layout/AlertBoundary';
import { SessionProvider } from 'next-auth/react';
import { AuthBoundary } from '../components/layout/AuthBoundary';
import { GlobalModal } from '../components/modals/GlobalModal';
import Head from 'next/head';

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
              <>
                <Head>
                  <title>The Cocktail-Manager</title>
                </Head>
                <Component {...pageProps} />
              </>
            </GlobalModal>
          </AuthBoundary>
        </ModalContext.Provider>
      </AlertBoundary>
    </SessionProvider>
  );
};

export default App;
