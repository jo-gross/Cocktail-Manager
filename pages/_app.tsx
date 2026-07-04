import { AppProps } from 'next/app';
import '../styles/global.css';
import React, { ReactNode, useReducer, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { AlertBoundary } from '@components/layout/AlertBoundary';
import { AuthBoundary } from '@components/layout/AuthBoundary';
import { GlobalModal } from '@components/modals/GlobalModal';
import Head from 'next/head';
import ThemeBoundary from '../components/layout/ThemeBoundary';
import { RoutingContextProvider } from '@lib/context/RoutingContextProvider';
import PullToRefresh from '@components/PullToRefresh';
import { NextPageWithPullToRefresh } from '../types/next';
import { OfflineContextProvider } from '@lib/context/OfflineContextProvider';
import { OfflineBanner } from '@components/layout/OfflineBanner';

export type AppPropsWithPullToRefresh = AppProps & {
  Component: NextPageWithPullToRefresh;
};

const App = ({ Component, pageProps: { session, ...pageProps } }: AppPropsWithPullToRefresh) => {
  const [modalContentStack, setModalContentStack] = useState<ReactNode[]>([]);
  const [modalHideCloseButton, setModalHideCloseButton] = useState<boolean[]>([]);

  const customRefresh = Component.pullToRefresh;

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  return (
    <OfflineContextProvider>
      <RoutingContextProvider>
        <ModalContext.Provider
          value={{
            content: modalContentStack,
            hideCloseButton: modalHideCloseButton,
            openModal: async (content, hideCloseButton) => {
              if (!(document.getElementById('globalModal') as HTMLDialogElement)?.open) {
                (document.getElementById('globalModal') as HTMLDialogElement).showModal();
              }

              // The await has the effect in chrome, that the modal was not replaces otherwise
              setModalContentStack((previousContent) => [...previousContent, content]);
              setModalHideCloseButton((previousHideCloseButton) => [...previousHideCloseButton, hideCloseButton ?? false]);
            },
            async closeModal() {
              setModalContentStack((previousContent) => {
                if (previousContent.length == 0) {
                  return previousContent;
                }

                if (previousContent.length == 1 && (document.getElementById('globalModal') as HTMLDialogElement | null)?.open == true) {
                  (document.getElementById('globalModal') as HTMLDialogElement).close();
                }

                return previousContent.slice(0, -1);
              });
              setModalHideCloseButton((previousHideCloseButton) =>
                previousHideCloseButton.length > 0 ? previousHideCloseButton.slice(0, -1) : previousHideCloseButton,
              );

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
          <AuthBoundary>
            <AlertBoundary>
              <GlobalModal>
                <ThemeBoundary>
                  <>
                    <Head>
                      <title>The Cocktail-Manager</title>
                    </Head>
                    <OfflineBanner />
                    <PullToRefresh onRefresh={customRefresh}>
                      <Component {...pageProps} />
                    </PullToRefresh>
                  </>
                </ThemeBoundary>
              </GlobalModal>
            </AlertBoundary>
          </AuthBoundary>
        </ModalContext.Provider>
      </RoutingContextProvider>
    </OfflineContextProvider>
  );
};

export default App;
