import { AppProps } from 'next/app';
import '../styles/global.css';
import React, { useReducer, useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { AlertBoundary } from '../components/layout/AlertBoundary';
import { SessionProvider } from 'next-auth/react';
import { AuthBoundary } from '../components/layout/AuthBoundary';
import { GlobalModal } from '../components/modals/GlobalModal';
import Head from 'next/head';
import ThemeBoundary from '../components/layout/ThemeBoundary';

const App = ({ Component, pageProps: { session, ...pageProps } }: AppProps) => {
  const [modalContentStack, setModalContentStack] = useState<JSX.Element[]>([]);

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const [theme, setTheme] = useState<'dark' | 'auto' | 'light'>('auto');

  return (
    <SessionProvider session={session}>
      <AlertBoundary>
        <ModalContext.Provider
          value={{
            content: modalContentStack,
            openModal: async (content) => {
              if ((document.getElementById('globalModal') as HTMLDialogElement)?.open == false) {
                (document.getElementById('globalModal') as HTMLDialogElement).showModal();
              }

              // The await has the effect in chrome, that the modal was not replaces otherwise
              setModalContentStack([...modalContentStack, content]);
            },
            async closeModal() {
              if (modalContentStack.length > 0) {
                setModalContentStack(modalContentStack.slice(0, modalContentStack.length - 1));

                if (modalContentStack.length == 1 && (document.getElementById('globalModal') as HTMLDialogElement | null)?.open == true) {
                  (document.getElementById('globalModal') as HTMLDialogElement).close();
                }
              } else {
                if (modalContentStack.length == 0 && (document.getElementById('globalModal') as HTMLDialogElement | null)?.open == true) {
                  (document.getElementById('globalModal') as HTMLDialogElement).close();
                }
              }

              forceUpdate();
            },
          }}
        >
          <AuthBoundary>
            <ThemeBoundary
              onThemeChange={(theme) => {
                setTheme(theme);
              }}
            >
              <GlobalModal>
                <>
                  <Head>
                    <title>The Cocktail-Manager</title>
                  </Head>
                  {theme != 'auto' ? (
                    <>
                      <input type="checkbox" hidden={true} checked={theme == 'dark'} readOnly={true} value="halloween" className="theme-controller toggle" />
                      <input type="checkbox" hidden={true} checked={theme == 'light'} readOnly={true} value="autumn" className="theme-controller toggle" />
                    </>
                  ) : (
                    <></>
                  )}
                  <Component {...pageProps} />
                </>
              </GlobalModal>
            </ThemeBoundary>
          </AuthBoundary>
        </ModalContext.Provider>
      </AlertBoundary>
    </SessionProvider>
  );
};

export default App;
