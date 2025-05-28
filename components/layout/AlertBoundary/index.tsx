import React from 'react';
import { AlertsContainer } from './AlertsContainer';
import { FaExclamationTriangle } from 'react-icons/fa';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
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
      <div className={'fixed bottom-2 left-1/2 z-50 w-full max-w-fit -translate-x-1/2 overflow-hidden print:hidden'}>
        {/*<div className="fixed bottom-2 left-2 right-2 z-50 flex flex-col items-center justify-center overflow-hidden print:hidden">*/}
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
