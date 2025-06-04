import React, { useContext } from 'react';
import { NetworkIndicatorContext } from '@lib/context/NetworkIndicatorContextProvider';

export default function NetworkOfflineIndicator(props: any) {
  const networkContext = useContext(NetworkIndicatorContext);

  return (
    !networkContext.isOnline && (
      <div className={'fixed left-0 top-0 z-50 flex h-12 w-full items-center justify-center print:hidden'}>
        <div className={'badge fixed bg-base-200 p-4 pl-12 pr-12'}>Du bist Offline</div>
      </div>
    )
  );
}
