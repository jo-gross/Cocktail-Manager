import React, { useContext } from 'react';
import { AlertsContainer } from './AlertsContainer';
import { FaExclamationTriangle } from 'react-icons/fa';
import { NetworkIndicatorContext } from '@lib/context/NetworkIndicatorContextProvider';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
  const networkContext = useContext(NetworkIndicatorContext);

  return (
    <div>
      <>
        {process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? (
          <>
            <div
              className={`fixed top-0 z-50 flex h-10 w-full flex-row items-center justify-center gap-2 overflow-hidden ${process.env.DEPLOYMENT == 'staging' ? 'bg-info' : 'bg-warning'} p-2 text-white`}
            >
              <FaExclamationTriangle />
              Achtung sie befinden sich in der {process.env.DEPLOYMENT == 'staging' ? 'Staging' : 'Entwicklungs'}-Umgebung
            </div>
            <div className={'h-10'}></div>
          </>
        ) : (
          <></>
        )}
      </>
      {!networkContext.isOnline && (
        <div className={'fixed left-0 top-0 z-50 flex h-12 w-full items-center justify-center print:hidden'}>
          <div className={'badge fixed bg-base-200 p-4 pl-12 pr-12'}>Du bist Offline</div>
        </div>
      )}
      <div className={'fixed bottom-2 left-1/2 z-50 w-full max-w-fit -translate-x-1/2 overflow-hidden print:hidden'}>
        {/*<div className="fixed bottom-2 left-2 right-2 z-50 flex flex-col items-center justify-center overflow-hidden print:hidden">*/}
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
