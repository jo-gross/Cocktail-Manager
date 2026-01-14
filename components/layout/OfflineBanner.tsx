import React from 'react';
import { FaWifi } from 'react-icons/fa';
import { useOffline } from '@lib/context/OfflineContextProvider';

interface OfflineBannerProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Persistent banner that displays when the app is offline.
 * Shows at the top of the page and remains visible until connection is restored.
 */
export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const { isOnline, isOfflineMode } = useOffline();

  // Don't render if online and not in offline mode
  if (isOnline && !isOfflineMode) {
    return null;
  }

  return (
    <div
      className={`sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-warning px-4 py-2 text-white shadow-md ${className}`}
      role="alert"
      aria-live="polite"
    >
      <FaWifi className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-medium">Du bist offline – Einige Funktionen sind eingeschränkt. Daten werden aus dem Cache geladen.</span>
    </div>
  );
}

export default OfflineBanner;
