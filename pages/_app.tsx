import { AppProps } from 'next/app';
import '../styles/global.css';
import React, { ReactNode, useCallback, useEffect, useReducer, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { AlertBoundary } from '@components/layout/AlertBoundary';
import { SessionProvider } from 'next-auth/react';
import { AuthBoundary } from '@components/layout/AuthBoundary';
import { GlobalModal } from '@components/modals/GlobalModal';
import Head from 'next/head';
import ThemeBoundary from '../components/layout/ThemeBoundary';
import { RoutingContextProvider } from '@lib/context/RoutingContextProvider';
import PullToRefresh from '@components/PullToRefresh';
import { NextPageWithPullToRefresh } from '../types/next';
import { NetworkIndicatorContext } from '@lib/context/NetworkIndicatorContextProvider';
import { alertService } from '@lib/alertService';

export type AppPropsWithPullToRefresh = AppProps & {
  Component: NextPageWithPullToRefresh;
};

const App = ({ Component, pageProps: { session, ...pageProps } }: AppPropsWithPullToRefresh) => {
  const [modalContentStack, setModalContentStack] = useState<ReactNode[]>([]);
  const [modalHideCloseButton, setModalHideCloseButton] = useState<boolean[]>([]);

  const customRefresh = Component.pullToRefresh;

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const [theme, setTheme] = useState<'dark' | 'auto' | 'light'>('auto');

  // TODO Offline Detector not working properly
  const [onlineStatus, setOnlineStatus] = useState<boolean>(true);

  const updateStatus = useCallback(() => {
    const online = navigator.onLine;

    if (online) {
      if (!onlineStatus) {
        alertService.info('Du bist wieder online!');
      }
    } else {
      if (onlineStatus) {
        alertService.error('Du bist offline! Einige Funktionen sind nicht verfügbar.');
      }
    }
    setOnlineStatus(online);

    console.log(`Network status updated: ${navigator.onLine ? 'Online' : 'Offline'}`);
  }, [onlineStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('Registering network status listeners');
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [updateStatus]);

  return (
    <SessionProvider session={session}>
      <RoutingContextProvider>
        <NetworkIndicatorContext.Provider
          value={{
            isOnline: onlineStatus,
            updateOnlineStatus: (status) => {
              setOnlineStatus(status);
            },
          }}
        >
          <ModalContext.Provider
            value={{
              content: modalContentStack,
              hideCloseButton: modalHideCloseButton,
              openModal: async (content, hideCloseButton) => {
                if (!(document.getElementById('globalModal') as HTMLDialogElement)?.open) {
                  (document.getElementById('globalModal') as HTMLDialogElement).showModal();
                }

                // The await has the effect in chrome, that the modal was not replaces otherwise
                setModalContentStack([...modalContentStack, content]);
                setModalHideCloseButton([...modalHideCloseButton, hideCloseButton ?? false]);
              },
              async closeModal() {
                if (modalContentStack.length > 0) {
                  setModalContentStack(modalContentStack.slice(0, modalContentStack.length - 1));
                  setModalHideCloseButton(modalHideCloseButton.slice(0, modalHideCloseButton.length - 1));

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
              closeAllModals() {
                setModalContentStack([]);
                setModalHideCloseButton([]);
                if ((document.getElementById('globalModal') as HTMLDialogElement | null)?.open == true) {
                  (document.getElementById('globalModal') as HTMLDialogElement).close();
                }
                forceUpdate();
              },
            }}
          >
            <AlertBoundary>
              <AuthBoundary>
                <GlobalModal>
                  <ThemeBoundary
                    onThemeChange={(theme) => {
                      setTheme(theme);
                    }}
                  >
                    <>
                      <Head>
                        <title>The Cocktail-Manager</title>
                      </Head>
                      {theme != 'auto' ? (
                        <>
                          <input
                            type="checkbox"
                            hidden={true}
                            checked={theme == 'dark'}
                            readOnly={true}
                            value="halloween"
                            className="theme-controller toggle"
                          />
                          <input type="checkbox" hidden={true} checked={theme == 'light'} readOnly={true} value="autumn" className="theme-controller toggle" />
                        </>
                      ) : (
                        <></>
                      )}
                      <PullToRefresh onRefresh={customRefresh}>
                        <Component {...pageProps} />
                      </PullToRefresh>
                    </>
                  </ThemeBoundary>
                </GlobalModal>
              </AuthBoundary>
            </AlertBoundary>
          </ModalContext.Provider>
        </NetworkIndicatorContext.Provider>
      </RoutingContextProvider>
    </SessionProvider>
  );
};

export default App;
