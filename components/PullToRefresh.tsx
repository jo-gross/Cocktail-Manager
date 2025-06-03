import { useRouter } from 'next/router';
import { usePullToRefresh } from 'use-pull-to-refresh';
import { ReactNode } from 'react';
import { FaArrowRotateLeft } from 'react-icons/fa6';

const MAXIMUM_PULL_LENGTH = 240;
const REFRESH_THRESHOLD = 180;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => void;
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const { isReady, reload } = useRouter();

  const { isRefreshing, pullPosition } = usePullToRefresh({
    // you can choose what behavior for `onRefresh`, could be calling an API to load more data, or refresh whole page.
    onRefresh: onRefresh ? onRefresh : reload,
    maximumPullLength: MAXIMUM_PULL_LENGTH,
    refreshThreshold: REFRESH_THRESHOLD,
    isDisabled: !isReady,
  });

  return (
    <>
      <div
        style={{
          top: (isRefreshing ? REFRESH_THRESHOLD : pullPosition) / 3,
          opacity: isRefreshing || pullPosition > 0 ? 1 : 0,
        }}
        className="fixed inset-x-1/2 z-30 h-8 w-8 -translate-x-1/2 rounded-full bg-base-100 p-2 shadow"
      >
        <div className={`h-full w-full ${isRefreshing ? 'animate-spin' : ''}`} style={!isRefreshing ? { transform: `rotate(${pullPosition}deg)` } : {}}>
          <FaArrowRotateLeft className="h-full w-full" />
        </div>
      </div>
      {children}
    </>
  );
}
