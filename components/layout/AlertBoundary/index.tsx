import React from 'react';
import { AlertsContainer } from './AlertsContainer';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
  return (
    <div>
      <div className="fixed top-10 right-10 z-50 overflow-hidden flex flex-col items-center justify-center print:hidden">
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
