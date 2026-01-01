import React, { useContext, useEffect, useState } from 'react';
import { AlertsContainer } from './AlertsContainer';
import { FaExclamationTriangle } from 'react-icons/fa';
import { UserContext } from '@lib/context/UserContextProvider';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AlertBoundary(props: AlertBoundaryProps) {
  const userContext = useContext(UserContext);
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    if (userContext.workspace?.isDemo && userContext.workspace?.expiresAt) {
      const updateRemainingTime = () => {
        const now = new Date();
        const expiresAt = new Date(userContext.workspace!.expiresAt!);
        const diff = expiresAt.getTime() - now.getTime();

        if (diff <= 0) {
          setRemainingTime('abgelaufen');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          setRemainingTime(`${hours}h ${minutes}m`);
        } else {
          setRemainingTime(`${minutes}m`);
        }
      };

      updateRemainingTime();
      const interval = setInterval(updateRemainingTime, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [userContext.workspace]);

  const isDemoWorkspace = userContext.workspace?.isDemo === true;
  const showDevStagingBanner = process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging';
  const bannerHeight = showDevStagingBanner || isDemoWorkspace ? (showDevStagingBanner && isDemoWorkspace ? 'h-20' : 'h-10') : '';

  return (
    <div>
      <>
        {showDevStagingBanner && (
          <>
            <div
              className={`fixed top-0 z-50 flex h-10 w-full flex-row items-center justify-center gap-2 overflow-hidden ${process.env.DEPLOYMENT == 'staging' ? 'bg-info' : 'bg-warning'} p-2 text-white`}
            >
              <FaExclamationTriangle />
              Achtung sie befinden sich in der {process.env.DEPLOYMENT == 'staging' ? 'Staging' : 'Entwicklungs'}-Umgebung
            </div>
          </>
        )}
        {isDemoWorkspace && (
          <div
            className={`fixed ${showDevStagingBanner ? 'top-10' : 'top-0'} z-50 flex h-10 w-full flex-row items-center justify-center gap-2 overflow-hidden bg-info p-2 text-white`}
          >
            <FaExclamationTriangle />
            Demo-Version - Verbleibende Zeit: {remainingTime || 'wird berechnet...'}
          </div>
        )}
        {(showDevStagingBanner || isDemoWorkspace) && <div className={bannerHeight}></div>}
      </>
      <div className={'fixed bottom-2 left-1/2 z-50 w-full max-w-fit -translate-x-1/2 overflow-hidden print:hidden'}>
        {/*<div className="fixed bottom-2 left-2 right-2 z-50 flex flex-col items-center justify-center overflow-hidden print:hidden">*/}
        <AlertsContainer />
      </div>
      {props.children}
    </div>
  );
}
