import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { Alert, type AlertVariant } from '@components/ui';

/** The one hint style of the setup wizard and the start content panel. */
export function SetupHint({ variant = 'info', className, children }: { variant?: AlertVariant; className?: string; children: React.ReactNode }) {
  return (
    // Static hints are notes; only warnings/errors are announced as alerts.
    <Alert variant={variant} icon={<FaInfoCircle aria-hidden />} className={className} {...(variant === 'info' ? { role: 'note' } : {})}>
      {children}
    </Alert>
  );
}
