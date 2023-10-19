import { AppProps } from 'next/app';
import '../styles/global.css';
import { useReducer, useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { AlertBoundary } from '../components/layout/AlertBoundary';
import { SessionProvider } from 'next-auth/react';
import { AuthBoundary } from '../components/layout/AuthBoundary';
import { GlobalModal } from '../components/modals/GlobalModal';
import Head from 'next/head';

const App = ({ Component, pageProps: { session, ...pageProps } }: AppProps) => {
  const [modalContent, setModalContent] = useState(<></>);

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  return (
    <SessionProvider session={session}>
      <AlertBoundary>
        <ModalContext.Provider
          value={{
            content: modalContent,
            openModal: async (content) => {
              if ((document.getElementById('globalModal') as any)?.checked == false) {
                (document.querySelector('#globalModal') as any).checked = true;
              }
              // The await has the effect in chrome, that the modal was not replaces otherwise
              await setModalContent(<></>);
              setModalContent(content);
            },
            async closeModal() {
              if ((document.getElementById('globalModal') as HTMLInputElement | null)?.checked == true) {
                (document.querySelector('#globalModal') as any).checked = false;
              }
              forceUpdate();
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
