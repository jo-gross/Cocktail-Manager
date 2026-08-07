import { AppProps } from 'next/app';
import '../styles/global.css';
import React, { ReactNode, useReducer, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { AlertBoundary } from '@components/layout/AlertBoundary';
import { AuthBoundary } from '@components/layout/AuthBoundary';
import { GlobalModal } from '@components/modals/GlobalModal';
import Head from 'next/head';
import ThemeBoundary from '../components/layout/ThemeBoundary';
import LanguageBoundary from '../components/layout/LanguageBoundary';
import { RoutingContextProvider } from '@lib/context/RoutingContextProvider';
import PullToRefresh from '@components/PullToRefresh';
import { NextPageWithPullToRefresh } from '../types/next';
import { OfflineContextProvider } from '@lib/context/OfflineContextProvider';
import { OfflineBanner } from '@components/layout/OfflineBanner';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@lib/i18n/client';

const i18n = initI18n();

function AppHead() {
  const { t } = useTranslation('common');
  return (
    <Head>
      <title>{t('appName')}</title>
    </Head>
  );
}

export type AppPropsWithPullToRefresh = AppProps & {
  Component: NextPageWithPullToRefresh;
};

const App = ({ Component, pageProps: { session: _session, ...pageProps } }: AppPropsWithPullToRefresh) => {
  const [modalContentStack, setModalContentStack] = useState<ReactNode[]>([]);
  const [modalHideCloseButton, setModalHideCloseButton] = useState<boolean[]>([]);

  const customRefresh = Component.pullToRefresh;

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  return (
    <I18nextProvider i18n={i18n}>
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
                    <LanguageBoundary>
                      <>
                        <AppHead />
                        <OfflineBanner />
                        <PullToRefresh onRefresh={customRefresh}>
                          <Component {...pageProps} />
                        </PullToRefresh>
                      </>
                    </LanguageBoundary>
                  </ThemeBoundary>
                </GlobalModal>
              </AlertBoundary>
            </AuthBoundary>
          </ModalContext.Provider>
        </RoutingContextProvider>
      </OfflineContextProvider>
    </I18nextProvider>
  );
};

export default App;
