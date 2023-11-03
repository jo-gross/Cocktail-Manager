import React from 'react';
import { AlertsContainer } from './AlertsContainer';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
  return (
    <div>
      <div className="fixed right-10 top-10 z-50 flex flex-col items-center justify-center overflow-hidden print:hidden">
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
