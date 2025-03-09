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
        {process.env.NODE_ENV == 'development' ? (
          <>
            <div className={'fixed top-0 z-50 flex h-10 w-full flex-row items-center justify-center gap-2 overflow-hidden bg-warning p-2 text-white'}>
              <FaExclamationTriangle />
              Achtung sie befinden sich in der Entwicklungs-Umgebung
            </div>
            <div className={'h-10'}></div>
          </>
        ) : (
          <></>
        )}
      </>
      <div className="fixed bottom-2 left-2 right-2 z-50 ml-2 flex flex-col items-center justify-center overflow-hidden print:hidden">
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
