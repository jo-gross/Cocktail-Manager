import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * DOM node in the top-right of the surrounding header (page header or form modal title row).
 * Lets content deep inside a page – e.g. a form's save button – render its primary action there.
 * `null` = no header around; `{ slot: null }` = header exists but isn't mounted yet.
 */
export const HeaderActionsSlotContext = createContext<{ slot: HTMLElement | null } | null>(null);

/** Renders `children` into the surrounding header's action area; `fallback` when there is no header. */
export function HeaderActionsPortal({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const context = useContext(HeaderActionsSlotContext);
  if (context == null) return <>{fallback}</>;
  return context.slot ? createPortal(children, context.slot) : null;
}
