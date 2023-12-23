import React from 'react';
import { AlertsContainer } from './AlertsContainer';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
  return (
    <div>
      <div className="fixed right-2 top-2 z-50 ml-2 flex flex-col items-center justify-center overflow-hidden md:right-10 md:top-10 print:hidden">
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
